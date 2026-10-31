import { Router } from 'express';
import { ConceptType, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../utils/async-handler';
import { parseParams, parseQuery, validateBody } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';

export const conceptsRouter = Router();

const idSchema = z.object({ id: z.string().uuid() });

const listSchema = z.object({
  search: z.string().trim().optional(),
  active: z.enum(['true', 'false']).optional(),
  type: z.nativeEnum(ConceptType).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.nativeEnum(ConceptType).default('OTRO'),
  defaultAmount: z.coerce.number().positive('El monto debe ser mayor a cero'),
  recurring: z.boolean().default(false),
  description: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.string().trim().max(2000).optional(),
  ),
  active: z.boolean().default(true),
});

const updateSchema = createSchema.partial();

conceptsRouter.use(authenticate);

conceptsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseQuery<z.infer<typeof listSchema>>(listSchema, req);

    const where: Prisma.ConceptWhereInput = {};
    if (query.search) where.name = { contains: query.search };
    if (query.active !== undefined) where.active = query.active === 'true';
    if (query.type) where.type = query.type;

    const data = await prisma.concept.findMany({
      where,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { fees: true } } },
    });

    res.json({ data });
  }),
);

conceptsRouter.post(
  '/',
  authorize('ADMIN', 'TESORERO'),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const concept = await prisma.concept.create({ data: body });
    res.status(201).json(concept);
  }),
);

conceptsRouter.put(
  '/:id',
  authorize('ADMIN', 'TESORERO'),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);
    const body = req.body as z.infer<typeof updateSchema>;
    const concept = await prisma.concept.update({ where: { id }, data: body });
    res.json(concept);
  }),
);

conceptsRouter.delete(
  '/:id',
  authorize('ADMIN'),
  asyncHandler(async (req, res) => {
    const { id } = parseParams<{ id: string }>(idSchema, req);
    const concept = await prisma.concept.update({ where: { id }, data: { active: false } });
    res.json(concept);
  }),
);
