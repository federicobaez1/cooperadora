import { Router } from 'express';
import { ExpenseStatus, PaymentMethod, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../utils/async-handler';
import { HttpError } from '../../utils/http-error';
import { parseParams, parseQuery, validateBody } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { dec } from '../../utils/money';
import { dateRange } from '../../utils/period';

export const expensesRouter = Router();

const idSchema = z.object({ id: z.string().uuid() });

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const listSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  category: z.string().trim().optional(),
  status: z.nativeEnum(ExpenseStatus).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  date: z.coerce.date().optional(),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().min(3).max(2000),
  amount: z.coerce.number().positive(),
  method: z.nativeEnum(PaymentMethod).default('EFECTIVO'),
  reference: optionalText(120),
});

const updateSchema = createSchema.partial();

const cancelSchema = z.object({
  reason: z.string().trim().min(3, 'Indicá un motivo').max(500),
});

expensesRouter.use(authenticate);

expensesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseQuery<z.infer<typeof listSchema>>(listSchema, req);

    const where: Prisma.ExpenseWhereInput = {};
    const range = dateRange(query.from, query.to);
    if (range.gte || range.lte) where.date = range;
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { description: { contains: query.search } },
        { reference: { contains: query.search } },
      ];
    }

    const [total, data, totals] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.expense.aggregate({
        where: { ...where, status: 'ACTIVO' },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      data,
      totalActive: totals._sum.amount ?? 0,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  }),
);

expensesRouter.post(
  '/',
  authorize('ADMIN', 'TESORERO'),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;

    const expense = await prisma.expense.create({
      data: {
        date: body.date ?? new Date(),
        category: body.category,
        description: body.description,
        amount: dec(body.amount),
        method: body.method,
        reference: body.reference,
        createdById: req.user!.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    res.status(201).json(expense);
  }),
);

expensesRouter.put(
  '/:id',
  authorize('ADMIN', 'TESORERO'),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);
    const body = req.body as z.infer<typeof updateSchema>;

    const current = await prisma.expense.findUnique({ where: { id } });
    if (!current) throw new HttpError(404, 'Egreso no encontrado');
    if (current.status === 'ANULADO') throw new HttpError(400, 'No se puede editar un egreso anulado');

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        date: body.date,
        category: body.category,
        description: body.description,
        amount: body.amount !== undefined ? dec(body.amount) : undefined,
        method: body.method,
        reference: body.reference,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    res.json(expense);
  }),
);

expensesRouter.post(
  '/:id/cancel',
  authorize('ADMIN', 'TESORERO'),
  validateBody(cancelSchema),
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);
    const { reason } = req.body as z.infer<typeof cancelSchema>;

    const current = await prisma.expense.findUnique({ where: { id } });
    if (!current) throw new HttpError(404, 'Egreso no encontrado');
    if (current.status === 'ANULADO') throw new HttpError(400, 'El egreso ya está anulado');

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        status: 'ANULADO',
        cancelledAt: new Date(),
        cancelledById: req.user!.id,
        cancelReason: reason,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    res.json(expense);
  }),
);
