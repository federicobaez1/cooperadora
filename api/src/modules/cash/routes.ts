import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../utils/async-handler';
import { HttpError } from '../../utils/http-error';
import { parseParams, parseQuery, validateBody } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { dec, num } from '../../utils/money';

export const cashRouter = Router();

const idSchema = z.object({ id: z.string().uuid() });

const openSchema = z.object({
  openingAmount: z.coerce.number().min(0).default(0),
  notes: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.string().trim().max(2000).optional(),
  ),
});

const closeSchema = z.object({
  countedAmount: z.coerce.number().min(0),
  notes: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.string().trim().max(2000).optional(),
  ),
});

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const sessionInclude = {
  openedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
} satisfies Prisma.CashSessionInclude;

const cashTotals = async (from: Date, to?: Date) => {
  const dateFilter = to ? { gte: from, lte: to } : { gte: from };

  const [income, expenses] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: 'ACTIVO', method: 'EFECTIVO', createdAt: dateFilter },
      _sum: { total: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { status: 'ACTIVO', method: 'EFECTIVO', createdAt: dateFilter },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    cashIncome: num(income._sum.total),
    cashExpenses: num(expenses._sum.amount),
    paymentsCount: income._count,
    expensesCount: expenses._count,
  };
};

cashRouter.use(authenticate);

cashRouter.get(
  '/current',
  asyncHandler(async (_req, res) => {
    const session = await prisma.cashSession.findFirst({
      where: { status: 'ABIERTA' },
      include: sessionInclude,
      orderBy: { openedAt: 'desc' },
    });

    if (!session) {
      res.json({ session: null, summary: null });
      return;
    }

    const totals = await cashTotals(session.openedAt);
    res.json({
      session,
      summary: {
        ...totals,
        expectedAmount: num(session.openingAmount) + totals.cashIncome - totals.cashExpenses,
      },
    });
  }),
);

cashRouter.post(
  '/open',
  authorize('ADMIN', 'TESORERO'),
  validateBody(openSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof openSchema>;

    const openSession = await prisma.cashSession.findFirst({ where: { status: 'ABIERTA' } });
    if (openSession) throw new HttpError(400, 'Ya hay una caja abierta');

    const session = await prisma.cashSession.create({
      data: {
        openingAmount: dec(body.openingAmount),
        notes: body.notes,
        openedById: req.user!.id,
      },
      include: sessionInclude,
    });

    res.status(201).json(session);
  }),
);

cashRouter.post(
  '/close',
  authorize('ADMIN', 'TESORERO'),
  validateBody(closeSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof closeSchema>;

    const session = await prisma.cashSession.findFirst({
      where: { status: 'ABIERTA' },
      orderBy: { openedAt: 'desc' },
    });
    if (!session) throw new HttpError(400, 'No hay una caja abierta');

    const now = new Date();
    const totals = await cashTotals(session.openedAt, now);
    const expected = num(session.openingAmount) + totals.cashIncome - totals.cashExpenses;
    const difference = body.countedAmount - expected;

    const closed = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        closedAt: now,
        status: 'CERRADA',
        expectedAmount: dec(expected),
        countedAmount: dec(body.countedAmount),
        difference: dec(difference),
        closedById: req.user!.id,
        notes: body.notes ?? session.notes,
      },
      include: sessionInclude,
    });

    res.json({
      session: closed,
      summary: {
        ...totals,
        openingAmount: num(session.openingAmount),
        expectedAmount: expected,
        countedAmount: body.countedAmount,
        difference,
      },
    });
  }),
);

cashRouter.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    const query = parseQuery<z.infer<typeof listSchema>>(listSchema, req);

    const [total, data] = await Promise.all([
      prisma.cashSession.count(),
      prisma.cashSession.findMany({
        include: sessionInclude,
        orderBy: { openedAt: 'desc' },
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

cashRouter.get(
  '/sessions/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);

    const session = await prisma.cashSession.findUnique({
      where: { id },
      include: sessionInclude,
    });
    if (!session) throw new HttpError(404, 'Sesión de caja no encontrada');

    const end = session.closedAt ?? new Date();
    const dateFilter = { gte: session.openedAt, lte: end };

    const [payments, expenses, totals] = await Promise.all([
      prisma.payment.findMany({
        where: { status: 'ACTIVO', method: 'EFECTIVO', createdAt: dateFilter },
        include: { guardian: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.expense.findMany({
        where: { status: 'ACTIVO', method: 'EFECTIVO', createdAt: dateFilter },
        orderBy: { createdAt: 'asc' },
      }),
      cashTotals(session.openedAt, end),
    ]);

    res.json({
      session,
      payments,
      expenses,
      summary: {
        ...totals,
        openingAmount: num(session.openingAmount),
        expectedAmount: num(session.openingAmount) + totals.cashIncome - totals.cashExpenses,
      },
    });
  }),
);
