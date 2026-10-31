import { Router } from 'express';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../utils/async-handler';
import { HttpError } from '../../utils/http-error';
import { parseParams, parseQuery, validateBody } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { dec, feeBalance, feeTotal, num, statusForPayment } from '../../utils/money';
import { dateRange } from '../../utils/period';
import { getSettings } from '../../utils/settings';

export const paymentsRouter = Router();

const idSchema = z.object({ id: z.string().uuid() });

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const listSchema = z.object({
  search: z.string().trim().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  guardianId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  guardianId: z.string().uuid(),
  date: z.coerce.date().optional(),
  method: z.nativeEnum(PaymentMethod),
  notes: optionalText(2000),
  items: z
    .array(
      z.object({
        feeId: z.string().uuid(),
        amount: z.coerce.number().positive('El importe debe ser mayor a cero'),
      }),
    )
    .min(1, 'El pago debe tener al menos una cuota'),
});

const cancelSchema = z.object({
  reason: z.string().trim().min(3, 'Indicá un motivo').max(500),
});

const listInclude = {
  guardian: {
    select: { id: true, firstName: true, lastName: true, dni: true, phone: true },
  },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { allocations: true } },
} satisfies Prisma.PaymentInclude;

const detailInclude = {
  guardian: true,
  createdBy: { select: { id: true, name: true, email: true } },
  cancelledBy: { select: { id: true, name: true } },
  allocations: {
    include: {
      fee: {
        include: {
          concept: true,
          student: {
            select: { id: true, firstName: true, lastName: true, course: true, division: true },
          },
        },
      },
    },
  },
} satisfies Prisma.PaymentInclude;

paymentsRouter.use(authenticate);

paymentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseQuery<z.infer<typeof listSchema>>(listSchema, req);

    const and: Prisma.PaymentWhereInput[] = [];
    const range = dateRange(query.from, query.to);
    if (range.gte || range.lte) and.push({ date: range });
    if (query.method) and.push({ method: query.method });
    if (query.status) and.push({ status: query.status });
    if (query.guardianId) and.push({ guardianId: query.guardianId });
    if (query.search) {
      and.push({
        OR: [
          { receiptNumber: { contains: query.search } },
          { guardian: { firstName: { contains: query.search } } },
          { guardian: { lastName: { contains: query.search } } },
          { guardian: { dni: { contains: query.search } } },
        ],
      });
    }

    const where: Prisma.PaymentWhereInput = and.length ? { AND: and } : {};

    const [total, data] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: listInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    res.json({
      data,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  }),
);

paymentsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);
    const payment = await prisma.payment.findUnique({ where: { id }, include: detailInclude });
    if (!payment) throw new HttpError(404, 'Pago no encontrado');
    res.json(payment);
  }),
);

paymentsRouter.post(
  '/',
  authorize('ADMIN', 'TESORERO'),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;

    const payment = await prisma.$transaction(async (tx) => {
      const guardian = await tx.guardian.findUnique({ where: { id: body.guardianId } });
      if (!guardian) throw new HttpError(404, 'Familia no encontrada');

      const uniqueIds = new Set(body.items.map((item) => item.feeId));
      if (uniqueIds.size !== body.items.length) {
        throw new HttpError(400, 'Hay cuotas repetidas en el pago');
      }

      const fees = await tx.fee.findMany({
        where: { id: { in: [...uniqueIds] } },
        include: {
          student: { include: { guardians: true } },
          concept: true,
        },
      });

      if (fees.length !== uniqueIds.size) {
        throw new HttpError(404, 'Una o más cuotas no existen');
      }

      const feeMap = new Map(fees.map((fee) => [fee.id, fee]));
      let total = dec(0);

      for (const item of body.items) {
        const fee = feeMap.get(item.feeId)!;

        if (!fee.student.guardians.some((link) => link.guardianId === body.guardianId)) {
          throw new HttpError(
            400,
            `La cuota de ${fee.student.firstName} ${fee.student.lastName} no corresponde a esta familia`,
          );
        }
        if (fee.status === 'ANULADA') {
          throw new HttpError(400, 'Una de las cuotas está anulada');
        }
        if (fee.status === 'PAGA') {
          throw new HttpError(400, 'Una de las cuotas ya está paga');
        }

        const amount = dec(item.amount);
        const balance = feeBalance(fee);
        if (amount.gt(balance)) {
          throw new HttpError(
            400,
            `El importe supera el saldo de la cuota de ${fee.student.firstName} ${fee.student.lastName} (saldo $${num(balance).toFixed(2)})`,
          );
        }

        total = total.plus(amount);
      }

      const paymentDate = body.date ?? new Date();
      const year = paymentDate.getFullYear();
      const sequence = await tx.sequence.upsert({
        where: { name: `receipt-${year}` },
        create: { name: `receipt-${year}`, value: 1 },
        update: { value: { increment: 1 } },
      });
      const receiptNumber = `REC-${year}-${String(sequence.value).padStart(6, '0')}`;

      const created = await tx.payment.create({
        data: {
          receiptNumber,
          guardianId: body.guardianId,
          date: paymentDate,
          method: body.method,
          total,
          notes: body.notes,
          createdById: req.user!.id,
          allocations: {
            create: body.items.map((item) => ({
              feeId: item.feeId,
              amount: dec(item.amount),
            })),
          },
        },
        include: detailInclude,
      });

      for (const item of body.items) {
        const fee = feeMap.get(item.feeId)!;
        const paid = dec(fee.paidAmount).plus(dec(item.amount));
        await tx.fee.update({
          where: { id: fee.id },
          data: {
            paidAmount: paid,
            status: statusForPayment(feeTotal(fee), paid),
          },
        });
      }

      return created;
    });

    res.status(201).json(payment);
  }),
);

paymentsRouter.post(
  '/:id/cancel',
  authorize('ADMIN', 'TESORERO'),
  validateBody(cancelSchema),
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);
    const { reason } = req.body as z.infer<typeof cancelSchema>;

    const payment = await prisma.$transaction(async (tx) => {
      const current = await tx.payment.findUnique({
        where: { id },
        include: { allocations: { include: { fee: true } } },
      });

      if (!current) throw new HttpError(404, 'Pago no encontrado');
      if (current.status === 'ANULADO') throw new HttpError(400, 'El pago ya está anulado');

      for (const allocation of current.allocations) {
        const fee = allocation.fee;
        const paid = dec(fee.paidAmount).minus(allocation.amount);
        const safePaid = paid.lt(0) ? dec(0) : paid;

        await tx.fee.update({
          where: { id: fee.id },
          data: {
            paidAmount: safePaid,
            status: fee.status === 'ANULADA' ? 'ANULADA' : statusForPayment(feeTotal(fee), safePaid),
          },
        });
      }

      return tx.payment.update({
        where: { id },
        data: {
          status: 'ANULADO',
          cancelledAt: new Date(),
          cancelledById: req.user!.id,
          cancelReason: reason,
        },
        include: detailInclude,
      });
    });

    res.json(payment);
  }),
);

const methodLabel: Record<PaymentMethod, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  MERCADO_PAGO: 'Mercado Pago',
  CHEQUE: 'Cheque',
};

const money = (value: Prisma.Decimal | number): string =>
  `$ ${num(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

paymentsRouter.get(
  '/:id/receipt',
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);

    const [payment, settings] = await Promise.all([
      prisma.payment.findUnique({ where: { id }, include: detailInclude }),
      getSettings(),
    ]);

    if (!payment) throw new HttpError(404, 'Pago no encontrado');

    const doc = new PDFDocument({ size: 'A5', margin: 36, info: { Title: `Recibo ${payment.receiptNumber}` } });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="recibo-${payment.receiptNumber}.pdf"`,
    );
    doc.pipe(res);

    const width = doc.page.width - 72;
    const left = 36;

    doc.font('Helvetica-Bold').fontSize(15).text(settings['cooperative.name'] ?? 'Cooperadora Escolar', left, 36, { width });
    doc.font('Helvetica').fontSize(9);
    if (settings['cooperative.address']) doc.text(settings['cooperative.address'], { width });
    if (settings['cooperative.cuit']) doc.text(`CUIT: ${settings['cooperative.cuit']}`, { width });

    doc.moveDown(1.2);
    doc.font('Helvetica-Bold').fontSize(13).text('RECIBO DE PAGO', { width, align: 'center' });
    doc.font('Helvetica').fontSize(10).text(`N° ${payment.receiptNumber}`, { width, align: 'center' });
    doc.moveDown(0.8);

    const fecha = new Date(payment.date).toLocaleDateString('es-AR');
    doc.fontSize(9);
    doc.text(`Fecha: ${fecha}`, left, doc.y, { continued: true, width: width / 2 });
    doc.text(`Medio de pago: ${methodLabel[payment.method]}`, { width: width / 2, align: 'right' });
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').text('Familia / socio:', { continued: true });
    doc.font('Helvetica').text(` ${payment.guardian.lastName}, ${payment.guardian.firstName} (DNI ${payment.guardian.dni})`);
    if (payment.guardian.phone) doc.text(`Teléfono: ${payment.guardian.phone}`);
    doc.moveDown(0.8);

    const columns = [0, 150, 300, 360];
    const rowY = doc.y;
    doc.font('Helvetica-Bold').fontSize(8);
    doc.text('Alumno', left + columns[0], rowY, { width: 140 });
    doc.text('Concepto', left + columns[1], rowY, { width: 140 });
    doc.text('Período', left + columns[2], rowY, { width: 60 });
    doc.text('Importe', left + columns[3], rowY, { width: width - columns[3], align: 'right' });

    doc.moveTo(left, rowY + 12).lineTo(left + width, rowY + 12).strokeColor('#999999').stroke();
    doc.y = rowY + 18;

    doc.font('Helvetica').fontSize(8);
    for (const allocation of payment.allocations) {
      const y = doc.y;
      const student = allocation.fee.student;
      doc.text(`${student.lastName}, ${student.firstName}`, left + columns[0], y, { width: 140 });
      doc.text(allocation.fee.concept.name, left + columns[1], y, { width: 140 });
      doc.text(allocation.fee.period, left + columns[2], y, { width: 60 });
      doc.text(money(allocation.amount), left + columns[3], y, {
        width: width - columns[3],
        align: 'right',
      });
      doc.moveDown(0.4);
      if (doc.y > doc.page.height - 120) doc.addPage();
    }

    doc.moveDown(0.6);
    const totalY = doc.y;
    doc.moveTo(left, totalY).lineTo(left + width, totalY).strokeColor('#999999').stroke();
    doc.font('Helvetica-Bold').fontSize(11).text('TOTAL', left, totalY + 6, { width: width - 90 });
    doc.text(money(payment.total), left, totalY + 6, { width, align: 'right' });

    doc.moveDown(2);
    doc.font('Helvetica').fontSize(8).fillColor('#555555');
    if (payment.status === 'ANULADO') {
      doc.fillColor('#b00020').font('Helvetica-Bold').text(`PAGO ANULADO: ${payment.cancelReason ?? 'sin motivo'}`, { width });
    }
    doc.fillColor('#555555').font('Helvetica').text(
      `Emitido por ${payment.createdBy.name} el ${new Date(payment.createdAt).toLocaleString('es-AR')}`,
      { width },
    );
    doc.text('Documento generado por el sistema de gestión de la cooperadora.', { width });

    doc.end();
  }),
);
