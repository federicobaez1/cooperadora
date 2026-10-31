import { Router } from 'express';
import { GuardianRelation, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../utils/async-handler';
import { HttpError } from '../../utils/http-error';
import { parseParams, parseQuery, validateBody } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';

export const guardiansRouter = Router();

const idSchema = z.object({ id: z.string().uuid() });
const studentParamsSchema = z.object({ id: z.string().uuid(), studentId: z.string().uuid() });

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const optionalEmail = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.string().trim().email('Email inválido').max(180).optional(),
);

const listSchema = z.object({
  search: z.string().trim().optional(),
  active: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  dni: z.string().trim().min(5).max(20),
  email: optionalEmail,
  phone: optionalText(40),
  address: optionalText(255),
  notes: optionalText(2000),
  active: z.boolean().default(true),
  students: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        relation: z.nativeEnum(GuardianRelation).default('OTRO'),
        isPrimary: z.boolean().default(false),
      }),
    )
    .optional(),
});

const updateSchema = createSchema.omit({ students: true }).partial();

const linkStudentSchema = z.object({
  studentId: z.string().uuid(),
  relation: z.nativeEnum(GuardianRelation).default('OTRO'),
  isPrimary: z.boolean().default(false),
});

const studentSelect = {
  id: true,
  firstName: true,
  lastName: true,
  dni: true,
  course: true,
  division: true,
  shift: true,
  status: true,
} satisfies Prisma.StudentSelect;

guardiansRouter.use(authenticate);

guardiansRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseQuery<z.infer<typeof listSchema>>(listSchema, req);

    const where: Prisma.GuardianWhereInput = {};
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search } },
        { lastName: { contains: query.search } },
        { dni: { contains: query.search } },
        { email: { contains: query.search } },
      ];
    }
    if (query.active !== undefined) where.active = query.active === 'true';

    const [total, data] = await Promise.all([
      prisma.guardian.count({ where }),
      prisma.guardian.findMany({
        where,
        include: {
          students: { include: { student: { select: studentSelect } } },
          _count: { select: { payments: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
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

guardiansRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);

    const guardian = await prisma.guardian.findUnique({
      where: { id },
      include: {
        students: { include: { student: { select: studentSelect } } },
        payments: {
          orderBy: { date: 'desc' },
          take: 10,
          include: { allocations: true },
        },
      },
    });

    if (!guardian) throw new HttpError(404, 'Familia no encontrada');
    res.json(guardian);
  }),
);

guardiansRouter.post(
  '/',
  authorize('ADMIN', 'TESORERO'),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;

    const guardian = await prisma.guardian.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        dni: body.dni,
        email: body.email,
        phone: body.phone,
        address: body.address,
        notes: body.notes,
        active: body.active,
        students: body.students
          ? {
              create: body.students.map((item) => ({
                studentId: item.studentId,
                relation: item.relation,
                isPrimary: item.isPrimary,
              })),
            }
          : undefined,
      },
      include: {
        students: { include: { student: { select: studentSelect } } },
      },
    });

    res.status(201).json(guardian);
  }),
);

guardiansRouter.put(
  '/:id',
  authorize('ADMIN', 'TESORERO'),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);
    const body = req.body as z.infer<typeof updateSchema>;

    const guardian = await prisma.guardian.update({
      where: { id },
      data: body,
      include: {
        students: { include: { student: { select: studentSelect } } },
      },
    });

    res.json(guardian);
  }),
);

guardiansRouter.delete(
  '/:id',
  authorize('ADMIN', 'TESORERO'),
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);

    const guardian = await prisma.guardian.update({
      where: { id },
      data: { active: false },
      include: {
        students: { include: { student: { select: studentSelect } } },
      },
    });

    res.json(guardian);
  }),
);

guardiansRouter.post(
  '/:id/students',
  authorize('ADMIN', 'TESORERO'),
  validateBody(linkStudentSchema),
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);
    const body = req.body as z.infer<typeof linkStudentSchema>;

    const student = await prisma.student.findUnique({ where: { id: body.studentId } });
    if (!student) throw new HttpError(404, 'Alumno no encontrado');

    if (body.isPrimary) {
      await prisma.studentGuardian.updateMany({
        where: { studentId: body.studentId },
        data: { isPrimary: false },
      });
    }

    const link = await prisma.studentGuardian.upsert({
      where: {
        studentId_guardianId: { studentId: body.studentId, guardianId: id },
      },
      create: {
        studentId: body.studentId,
        guardianId: id,
        relation: body.relation,
        isPrimary: body.isPrimary,
      },
      update: {
        relation: body.relation,
        isPrimary: body.isPrimary,
      },
      include: { student: { select: studentSelect } },
    });

    res.status(201).json(link);
  }),
);

guardiansRouter.delete(
  '/:id/students/:studentId',
  authorize('ADMIN', 'TESORERO'),
  asyncHandler(async (req, res) => {
    const { id, studentId } = parseParams<{ id: string; studentId: string }>(studentParamsSchema, req);

    await prisma.studentGuardian.delete({
      where: { studentId_guardianId: { studentId, guardianId: id } },
    });

    res.status(204).send();
  }),
);
