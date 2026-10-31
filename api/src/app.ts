import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Prisma } from '@prisma/client';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { router } from './routes';
import { errorHandler, notFound } from './middlewares/error-handler';
import { asyncHandler } from './utils/async-handler';

export const app = express();

app.set('trust proxy', 1);

const serialize = (value: unknown): unknown => {
  if (value instanceof Prisma.Decimal) return Number(value);
  if (Array.isArray(value)) return value.map(serialize);
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serialize(item)]),
    );
  }
  return value;
};

app.use((_req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => originalJson(serialize(body))) as typeof res.json;
  next();
});

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get(
  '/api/health',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', uptime: process.uptime() });
  }),
);

app.use('/api', router);

app.use(notFound);
app.use(errorHandler);
