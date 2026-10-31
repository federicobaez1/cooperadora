import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../utils/async-handler';
import { HttpError } from '../../utils/http-error';
import { parseParams, parseQuery } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/auth';
import { feeBalance, feeTotal, num } from '../../utils/money';
import {
  dateRange,
  endOfMonthUtc,
  startOfDayUtc,
  startOfMonthUtc,
} from '../../utils/period';

export const reportsRouter = Router();

const rangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const monthlySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

const delinquentsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  period: z.string().optional(),
});

const resolveRange = (from?: string, to?: string): { start: Date; end: Date } => {
  const now = new Date();
  const start = from ? new Date(`${from}T00:00:00.000Z`) : startOfMonthUtc(now);
  const end = to ? new Date(`${to}T23:59:59.999Z`) : endOfMonthUtc(now);
  return { start, end };
};

const buildSummary = async (start: Date, end: Date) => {
  const [payments, expenses, pendingFees, activeStudents, activeGuardians] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: 'ACTIVO', date: { gte: start, lte: end } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { status: 'ACTIVO', date: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.fee.findMany({
      where: { status: { in: ['PENDIENTE', 'PARCIAL'] } },
      select: {
        amount: true,
        discount: true,
        surcharge: true,
        paidAmount: true,
        dueDate: true,
      },
    }),
    prisma.student.count({ where: { status: 'ACTIVO' } }),
    prisma.guardian.count({ where: { active: true } }),
  ]);

  let pendingTotal = 0;
  let pendingBalance = 0;
  let overdueBalance = 0;
  let overdueCount = 0;
  const today = startOfDayUtc();

  for (const fee of pendingFees) {
    pendingTotal += num(feeTotal(fee));
    const balance = num(feeBalance(fee));
    pendingBalance += balance;
    if (fee.dueDate < today) {
      overdueBalance += balance;
      overdueCount += 1;
    }
  }

  const income = num(payments._sum.total);
  const totalExpenses = num(expenses._sum.amount);

  return {
    period: { from: start, to: end },
    income,
    expenses: totalExpenses,
    balance: income - totalExpenses,
    paymentsCount: payments._count,
    expensesCount: expenses._count,
    pending: {
      count: pendingFees.length,
      total: pendingTotal,
      balance: pendingBalance,
    },
    overdue: {
      count: overdueCount,
      balance: overdueBalance,
    },
    activeStudents,
    activeGuardians,
  };
};

const buildMonthlyIncome = async (year: number) => {
  const rows = await prisma.$queryRaw<Array<{ month: string; total: Prisma.Decimal | number }>>`
    SELECT DATE_FORMAT(\`date\`, '%Y-%m') AS month, SUM(\`total\`) AS total
    FROM \`Payment\`
    WHERE \`status\` = 'ACTIVO' AND YEAR(\`date\`) = ${year}
    GROUP BY DATE_FORMAT(\`date\`, '%Y-%m')
    ORDER BY month ASC
  `;

  const map = new Map(rows.map((row) => [row.month, num(row.total)]));
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    return { month, total: map.get(month) ?? 0 };
  });
};

const buildDelinquents = async (limit: number, period?: string) => {
  const fees = await prisma.fee.findMany({
    where: {
      status: { in: ['PENDIENTE', 'PARCIAL'] },
      dueDate: { lt: startOfDayUtc() },
      ...(period ? { period } : {}),
    },
    include: {
      student: {
        include: {
          guardians: { include: { guardian: true } },
        },
      },
    },
  });

  const grouped = new Map<
    string,
    {
      studentId: string;
      student: string;
      dni: string;
      course: string;
      division: string;
      guardians: string[];
      feesCount: number;
      debt: number;
      oldestDueDate: Date;
    }
  >();

  for (const fee of fees) {
    const key = fee.studentId;
    const current = grouped.get(key) ?? {
      studentId: fee.studentId,
      student: `${fee.student.lastName}, ${fee.student.firstName}`,
      dni: fee.student.dni,
      course: fee.student.course,
      division: fee.student.division,
      guardians: fee.student.guardians.map(
        (link) => `${link.guardian.lastName}, ${link.guardian.firstName}`,
      ),
      feesCount: 0,
      debt: 0,
      oldestDueDate: fee.dueDate,
    };

    current.feesCount += 1;
    current.debt += num(feeBalance(fee));
    if (fee.dueDate < current.oldestDueDate) current.oldestDueDate = fee.dueDate;
    grouped.set(key, current);
  }

  return [...grouped.values()].sort((a, b) => b.debt - a.debt).slice(0, limit);
};

reportsRouter.use(authenticate);

reportsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const query = parseQuery<z.infer<typeof rangeSchema>>(rangeSchema, req);
    const { start, end } = resolveRange(query.from, query.to);
    res.json(await buildSummary(start, end));
  }),
);

reportsRouter.get(
  '/income-by-method',
  asyncHandler(async (req, res) => {
    const query = parseQuery<z.infer<typeof rangeSchema>>(rangeSchema, req);
    const { start, end } = resolveRange(query.from, query.to);

    const rows = await prisma.payment.groupBy({
      by: ['method'],
      where: { status: 'ACTIVO', date: { gte: start, lte: end } },
      _sum: { total: true },
      _count: true,
    });

    res.json({
      period: { from: start, to: end },
      data: rows.map((row) => ({
        method: row.method,
        total: num(row._sum.total),
        count: row._count,
      })),
    });
  }),
);

reportsRouter.get(
  '/monthly-income',
  asyncHandler(async (req, res) => {
    const query = parseQuery<z.infer<typeof monthlySchema>>(monthlySchema, req);
    const year = query.year ?? new Date().getFullYear();
    res.json({ year, data: await buildMonthlyIncome(year) });
  }),
);

reportsRouter.get(
  '/delinquents',
  asyncHandler(async (req, res) => {
    const query = parseQuery<z.infer<typeof delinquentsSchema>>(delinquentsSchema, req);
    const data = await buildDelinquents(query.limit, query.period);
    res.json({
      data,
      totalDebt: data.reduce((acc, item) => acc + item.debt, 0),
    });
  }),
);

reportsRouter.get(
  '/account/:guardianId',
  asyncHandler(async (req, res) => {
    const { guardianId } = parseParams<{ guardianId: string }>(
      z.object({ guardianId: z.string().uuid() }),
      req,
    );

    const guardian = await prisma.guardian.findUnique({
      where: { id: guardianId },
      include: {
        students: {
          include: {
            student: true,
          },
        },
      },
    });

    if (!guardian) throw new HttpError(404, 'Familia no encontrada');

    const studentIds = guardian.students.map((link) => link.studentId);

    const [fees, payments] = await Promise.all([
      prisma.fee.findMany({
        where: { studentId: { in: studentIds } },
        include: {
          concept: true,
          student: {
            select: { id: true, firstName: true, lastName: true, course: true, division: true },
          },
        },
        orderBy: [{ period: 'desc' }, { dueDate: 'desc' }],
      }),
      prisma.payment.findMany({
        where: { guardianId },
        include: {
          allocations: {
            include: {
              fee: {
                include: {
                  concept: true,
                  student: { select: { id: true, firstName: true, lastName: true } },
                },
              },
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
      }),
    ]);

    const activeFees = fees.filter((fee) => fee.status !== 'ANULADA');
    const totalFees = activeFees.reduce((acc, fee) => acc + num(feeTotal(fee)), 0);
    const totalPaid = activeFees.reduce((acc, fee) => acc + num(fee.paidAmount), 0);

    res.json({
      guardian,
      fees,
      payments,
      summary: {
        studentsCount: studentIds.length,
        feesCount: activeFees.length,
        totalFees,
        totalPaid,
        balance: totalFees - totalPaid,
        overdueBalance: activeFees
          .filter((fee) => fee.status !== 'PAGA' && fee.dueDate < startOfDayUtc())
          .reduce((acc, fee) => acc + num(feeBalance(fee)), 0),
      },
    });
  }),
);

reportsRouter.get(
  '/cash-book',
  asyncHandler(async (req, res) => {
    const query = parseQuery<z.infer<typeof rangeSchema>>(rangeSchema, req);
    const range = dateRange(query.from, query.to);
    const dateFilter = range.gte || range.lte ? range : undefined;

    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({
        where: { status: 'ACTIVO', ...(dateFilter ? { date: dateFilter } : {}) },
        include: { guardian: { select: { firstName: true, lastName: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.expense.findMany({
        where: { status: 'ACTIVO', ...(dateFilter ? { date: dateFilter } : {}) },
        orderBy: { date: 'asc' },
      }),
    ]);

    const entries = [
      ...payments.map((payment) => ({
        type: 'INGRESO' as const,
        date: payment.date,
        description: `Recibo ${payment.receiptNumber} - ${payment.guardian.lastName}, ${payment.guardian.firstName}`,
        method: payment.method,
        amount: num(payment.total),
        reference: payment.receiptNumber,
      })),
      ...expenses.map((expense) => ({
        type: 'EGRESO' as const,
        date: expense.date,
        description: expense.description,
        method: expense.method,
        amount: num(expense.amount),
        reference: expense.reference ?? '',
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    const withBalance = entries.map((entry) => {
      running += entry.type === 'INGRESO' ? entry.amount : -entry.amount;
      return { ...entry, balance: running };
    });

    res.json({
      period: { from: range.gte ?? null, to: range.lte ?? null },
      entries: withBalance,
      totals: {
        income: entries.filter((e) => e.type === 'INGRESO').reduce((acc, e) => acc + e.amount, 0),
        expenses: entries.filter((e) => e.type === 'EGRESO').reduce((acc, e) => acc + e.amount, 0),
        balance: running,
      },
    });
  }),
);

reportsRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const start = startOfMonthUtc(now);
    const end = endOfMonthUtc(now);

    const [summary, monthlyIncome, recentPayments, delinquents, cashSession] = await Promise.all([
      buildSummary(start, end),
      buildMonthlyIncome(now.getFullYear()),
      prisma.payment.findMany({
        where: { status: 'ACTIVO' },
        include: {
          guardian: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      buildDelinquents(5),
      prisma.cashSession.findFirst({
        where: { status: 'ABIERTA' },
        include: { openedBy: { select: { name: true } } },
        orderBy: { openedAt: 'desc' },
      }),
    ]);

    res.json({
      summary,
      monthlyIncome,
      recentPayments,
      delinquents,
      cashSession,
    });
  }),
);
