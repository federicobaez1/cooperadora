import { Router } from 'express';
import { GuardianRelation, Prisma, StudentStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../utils/async-handler';
import { HttpError } from '../../utils/http-error';
import { parseParams, parseQuery, validateBody } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';

export const studentsRouter = Router();

const idSchema = z.object({ id: z.string().uuid() });

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const optionalDate = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.date().optional(),
);

const listSchema = z.object({
  search: z.string().trim().optional(),
  course: z.string().trim().optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  dni: z.string().trim().min(5).max(20),
  birthDate: optionalDate,
  course: z.string().trim().min(1).max(20),
  division: z.string().trim().min(1).max(20),
  shift: z.string().trim().min(1).max(20),
  status: z.nativeEnum(StudentStatus).default('ACTIVO'),
  notes: optionalText(2000),
  guardians: z
    .array(
      z.object({
        guardianId: z.string().uuid(),
        relation: z.nativeEnum(GuardianRelation).default('OTRO'),
        isPrimary: z.boolean().default(false),
      }),
    )
    .optional(),
});

const updateSchema = createSchema.omit({ guardians: true }).partial();

const linkGuardianSchema = z.object({
  guardianId: z.string().uuid(),
  relation: z.nativeEnum(GuardianRelation).default('OTRO'),
  isPrimary: z.boolean().default(false),
});

const guardianSelect = {
  id: true,
  firstName: true,
  lastName: true,
  dni: true,
  email: true,
  phone: true,
  active: true,
} satisfies Prisma.GuardianSelect;

studentsRouter.use(authenticate);

studentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseQuery<z.infer<typeof listSchema>>(listSchema, req);

    const where: Prisma.StudentWhereInput = {};
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search } },
        { lastName: { contains: query.search } },
        { dni: { contains: query.search } },
      ];
    }
    if (query.course) where.course = query.course;
    if (query.status) where.status = query.status;

    const [total, data] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        include: {
          guardians: { include: { guardian: { select: guardianSelect } } },
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

studentsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        guardians: { include: { guardian: { select: guardianSelect } } },
        fees: {
          include: { concept: true, allocations: { include: { payment: true } } },
          orderBy: [{ period: 'desc' }, { dueDate: 'desc' }],
        },
      },
    });

    if (!student) throw new HttpError(404, 'Alumno no encontrado');
    res.json(student);
  }),
);

studentsRouter.post(
  '/',
  authorize('ADMIN', 'TESORERO'),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;

    const student = await prisma.student.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        dni: body.dni,
        birthDate: body.birthDate,
        course: body.course,
        division: body.division,
        shift: body.shift,
        status: body.status,
        notes: body.notes,
        guardians: body.guardians
          ? {
              create: body.guardians.map((item) => ({
                guardianId: item.guardianId,
                relation: item.relation,
                isPrimary: item.isPrimary,
              })),
            }
          : undefined,
      },
      include: {
        guardians: { include: { guardian: { select: guardianSelect } } },
      },
    });

    res.status(201).json(student);
  }),
);

studentsRouter.put(
  '/:id',
  authorize('ADMIN', 'TESORERO'),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);
    const body = req.body as z.infer<typeof updateSchema>;

    const student = await prisma.student.update({
      where: { id },
      data: body,
      include: {
        guardians: { include: { guardian: { select: guardianSelect } } },
      },
    });

    res.json(student);
  }),
);

studentsRouter.delete(
  '/:id',
  authorize('ADMIN', 'TESORERO'),
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);

    const student = await prisma.student.update({
      where: { id },
      data: { status: 'INACTIVO' },
      include: {
        guardians: { include: { guardian: { select: guardianSelect } } },
      },
    });

    res.json(student);
  }),
);

studentsRouter.post(
  '/:id/guardians',
  authorize('ADMIN', 'TESORERO'),
  validateBody(linkGuardianSchema),
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);
    const body = req.body as z.infer<typeof linkGuardianSchema>;

    const guardian = await prisma.guardian.findUnique({ where: { id: body.guardianId } });
    if (!guardian) throw new HttpError(404, 'Familia no encontrada');

    if (body.isPrimary) {
      await prisma.studentGuardian.updateMany({
        where: { studentId: id },
        data: { isPrimary: false },
      });
    }

    const link = await prisma.studentGuardian.upsert({
      where: {
        studentId_guardianId: { studentId: id, guardianId: body.guardianId },
      },
      create: {
        studentId: id,
        guardianId: body.guardianId,
        relation: body.relation,
        isPrimary: body.isPrimary,
      },
      update: {
        relation: body.relation,
        isPrimary: body.isPrimary,
      },
      include: { guardian: { select: guardianSelect } },
    });

    res.status(201).json(link);
  }),
);

studentsRouter.delete(
  '/:id/guardians/:guardianId',
  authorize('ADMIN', 'TESORERO'),
  asyncHandler(async (req, res) => {
    const { id, guardianId } = parseParams<{ id: string; guardianId: string }>(
      z.object({ id: z.string().uuid(), guardianId: z.string().uuid() }),
      req,
    );

    await prisma.studentGuardian.delete({
      where: { studentId_guardianId: { studentId: id, guardianId } },
    });

    res.status(204).send();
  }),
);
