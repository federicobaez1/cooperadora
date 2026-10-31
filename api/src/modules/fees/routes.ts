import { Router } from 'express';
import { FeeStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../utils/async-handler';
import { HttpError } from '../../utils/http-error';
import { parseParams, parseQuery, validateBody } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { PERIOD_REGEX, dueDateFor, startOfDayUtc } from '../../utils/period';
import { dec, feeBalance, feeTotal, statusForPayment } from '../../utils/money';
import { getSetting } from '../../utils/settings';

export const feesRouter = Router();

const idSchema = z.object({ id: z.string().uuid() });

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const listSchema = z.object({
  search: z.string().trim().optional(),
  period: z.string().regex(PERIOD_REGEX).optional(),
  status: z.nativeEnum(FeeStatus).optional(),
  studentId: z.string().uuid().optional(),
  guardianId: z.string().uuid().optional(),
  conceptId: z.string().uuid().optional(),
  overdue: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  studentId: z.string().uuid(),
  conceptId: z.string().uuid(),
  period: z.string().regex(PERIOD_REGEX, 'El período debe tener formato YYYY-MM'),
  amount: z.coerce.number().positive().optional(),
  discount: z.coerce.number().min(0).default(0),
  dueDate: z.coerce.date().optional(),
  notes: optionalText(2000),
});

const updateSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  discount: z.coerce.number().min(0).optional(),
  dueDate: z.coerce.date().optional(),
  notes: optionalText(2000),
});

const generateSchema = z.object({
  period: z.string().regex(PERIOD_REGEX, 'El período debe tener formato YYYY-MM'),
  conceptId: z.string().uuid(),
  amount: z.coerce.number().positive().optional(),
  dueDay: z.coerce.number().int().min(1).max(28).default(10),
  studentIds: z.array(z.string().uuid()).optional(),
});

const surchargeSchema = z.object({
  percent: z.coerce.number().min(0).max(100).optional(),
  period: z.string().regex(PERIOD_REGEX).optional(),
});

const include = {
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dni: true,
      course: true,
      division: true,
      shift: true,
      guardians: { include: { guardian: { select: { id: true, firstName: true, lastName: true } } } },
    },
  },
  concept: true,
  allocations: { include: { payment: { select: { id: true, receiptNumber: true, date: true, status: true } } } },
} satisfies Prisma.FeeInclude;

feesRouter.use(authenticate);

feesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseQuery<z.infer<typeof listSchema>>(listSchema, req);

    const and: Prisma.FeeWhereInput[] = [];

    if (query.search) {
      and.push({
        student: {
          OR: [
            { firstName: { contains: query.search } },
            { lastName: { contains: query.search } },
            { dni: { contains: query.search } },
          ],
        },
      });
    }
    if (query.guardianId) {
      and.push({ student: { guardians: { some: { guardianId: query.guardianId } } } });
    }
    if (query.studentId) and.push({ studentId: query.studentId });
    if (query.period) and.push({ period: query.period });
    if (query.status) and.push({ status: query.status });
    if (query.conceptId) and.push({ conceptId: query.conceptId });
    if (query.overdue === 'true') {
      and.push({ dueDate: { lt: startOfDayUtc() } });
      and.push({ status: { in: ['PENDIENTE', 'PARCIAL'] } });
    }

    const where: Prisma.FeeWhereInput = and.length ? { AND: and } : {};

    const [total, data] = await Promise.all([
      prisma.fee.count({ where }),
      prisma.fee.findMany({
        where,
        include,
        orderBy: [{ dueDate: 'desc' }, { student: { lastName: 'asc' } }],
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

feesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);
    const fee = await prisma.fee.findUnique({ where: { id }, include });
    if (!fee) throw new HttpError(404, 'Cuota no encontrada');
    res.json(fee);
  }),
);

feesRouter.post(
  '/',
  authorize('ADMIN', 'TESORERO'),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;

    const [student, concept] = await Promise.all([
      prisma.student.findUnique({ where: { id: body.studentId } }),
      prisma.concept.findUnique({ where: { id: body.conceptId } }),
    ]);
    if (!student) throw new HttpError(404, 'Alumno no encontrado');
    if (!concept) throw new HttpError(404, 'Concepto no encontrado');

    const fee = await prisma.fee.create({
      data: {
        studentId: body.studentId,
        conceptId: body.conceptId,
        period: body.period,
        amount: dec(body.amount ?? concept.defaultAmount),
        discount: dec(body.discount),
        dueDate: body.dueDate ?? dueDateFor(body.period),
        notes: body.notes,
      },
      include,
    });

    res.status(201).json(fee);
  }),
);

feesRouter.put(
  '/:id',
  authorize('ADMIN', 'TESORERO'),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);
    const body = req.body as z.infer<typeof updateSchema>;

    const current = await prisma.fee.findUnique({ where: { id } });
    if (!current) throw new HttpError(404, 'Cuota no encontrada');
    if (current.status === 'ANULADA') throw new HttpError(400, 'No se puede modificar una cuota anulada');

    if ((body.amount !== undefined || body.discount !== undefined) && current.paidAmount.gt(0)) {
      throw new HttpError(400, 'No se puede cambiar el monto de una cuota con pagos registrados');
    }

    const amount = body.amount !== undefined ? dec(body.amount) : current.amount;
    const discount = body.discount !== undefined ? dec(body.discount) : current.discount;
    const surcharge = current.surcharge;
    const total = amount.minus(discount).plus(surcharge);

    const fee = await prisma.fee.update({
      where: { id },
      data: {
        amount,
        discount,
        dueDate: body.dueDate,
        notes: body.notes,
        status: statusForPayment(total, current.paidAmount),
      },
      include,
    });

    res.json(fee);
  }),
);

feesRouter.post(
  '/generate',
  authorize('ADMIN', 'TESORERO'),
  validateBody(generateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof generateSchema>;

    const concept = await prisma.concept.findUnique({ where: { id: body.conceptId } });
    if (!concept) throw new HttpError(404, 'Concepto no encontrado');
    if (!concept.active) throw new HttpError(400, 'El concepto está inactivo');

    const students = await prisma.student.findMany({
      where: {
        status: 'ACTIVO',
        ...(body.studentIds ? { id: { in: body.studentIds } } : {}),
      },
      select: { id: true },
    });

    if (!students.length) throw new HttpError(400, 'No hay alumnos activos para generar cuotas');

    const amount = dec(body.amount ?? concept.defaultAmount);
    const dueDate = dueDateFor(body.period, body.dueDay);

    const result = await prisma.fee.createMany({
      data: students.map((student) => ({
        studentId: student.id,
        conceptId: concept.id,
        period: body.period,
        amount,
        dueDate,
      })),
      skipDuplicates: true,
    });

    res.status(201).json({
      message: 'Cuotas generadas',
      created: result.count,
      skipped: students.length - result.count,
      period: body.period,
      concept: concept.name,
    });
  }),
);

feesRouter.post(
  '/:id/cancel',
  authorize('ADMIN', 'TESORERO'),
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);

    const fee = await prisma.fee.findUnique({ where: { id } });
    if (!fee) throw new HttpError(404, 'Cuota no encontrada');
    if (fee.status === 'ANULADA') throw new HttpError(400, 'La cuota ya está anulada');
    if (fee.paidAmount.gt(0)) {
      throw new HttpError(400, 'No se puede anular una cuota con pagos registrados. Anulá primero los pagos.');
    }

    const updated = await prisma.fee.update({
      where: { id },
      data: { status: 'ANULADA' },
      include,
    });

    res.json(updated);
  }),
);

feesRouter.post(
  '/apply-surcharges',
  authorize('ADMIN', 'TESORERO'),
  validateBody(surchargeSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof surchargeSchema>;
    const setting = await getSetting('surcharge.percent', '10');
    const percent = body.percent ?? Number(setting);
    if (Number.isNaN(percent) || percent <= 0) {
      throw new HttpError(400, 'El porcentaje de recargo no es válido');
    }

    const fees = await prisma.fee.findMany({
      where: {
        status: { in: ['PENDIENTE', 'PARCIAL'] },
        dueDate: { lt: startOfDayUtc() },
        surcharge: { equals: 0 },
        ...(body.period ? { period: body.period } : {}),
      },
    });

    let updated = 0;
    for (const fee of fees) {
      const base = dec(fee.amount).minus(fee.discount);
      const surcharge = base.mul(percent).div(100);
      const total = base.plus(surcharge);
      await prisma.fee.update({
        where: { id: fee.id },
        data: {
          surcharge,
          status: statusForPayment(total, fee.paidAmount),
        },
      });
      updated += 1;
    }

    res.json({
      message: 'Recargos aplicados',
      updated,
      percent,
      pendingBalance: fees.reduce((acc, fee) => acc + Number(feeBalance(fee)), 0),
    });
  }),
);
