import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../utils/async-handler';
import { HttpError } from '../../utils/http-error';
import { validateBody, parseQuery, parseParams } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';

export const usersRouter = Router();

const idSchema = z.object({ id: z.string().uuid() });

const listSchema = z.object({
  search: z.string().trim().optional(),
  role: z.nativeEnum(Role).optional(),
  active: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(100),
  role: z.nativeEnum(Role).default('CONSULTA'),
  active: z.boolean().default(true),
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(180).optional(),
  password: z.string().min(8).max(100).optional(),
  role: z.nativeEnum(Role).optional(),
  active: z.boolean().optional(),
});

const select = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

usersRouter.use(authenticate, authorize('ADMIN'));

usersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseQuery<z.infer<typeof listSchema>>(listSchema, req);

    const where: Prisma.UserWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { email: { contains: query.search } },
      ];
    }
    if (query.role) where.role = query.role;
    if (query.active !== undefined) where.active = query.active === 'true';

    const [total, data] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select,
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
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

usersRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash: await bcrypt.hash(body.password, 10),
        role: body.role,
        active: body.active,
      },
      select,
    });

    res.status(201).json(user);
  }),
);

usersRouter.put(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);
    const body = req.body as z.infer<typeof updateSchema>;

    if (req.user!.id === id && body.active === false) {
      throw new HttpError(400, 'No podés desactivar tu propio usuario');
    }

    const data: Prisma.UserUpdateInput = {
      name: body.name,
      email: body.email?.toLowerCase(),
      role: body.role,
      active: body.active,
    };

    if (body.password) {
      data.passwordHash = await bcrypt.hash(body.password, 10);
    }

    const user = await prisma.user.update({ where: { id }, data, select });
    res.json(user);
  }),
);

usersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);

    if (req.user!.id === id) {
      throw new HttpError(400, 'No podés desactivar tu propio usuario');
    }

    const user = await prisma.user.update({ where: { id }, data: { active: false }, select });
    res.json(user);
  }),
);
