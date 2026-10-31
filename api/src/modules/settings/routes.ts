import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import { getSettings, upsertSettings } from '../../utils/settings';
import { authenticate, authorize } from '../../middlewares/auth';
import { validateBody } from '../../middlewares/validate';

export const settingsRouter = Router();

const publicKeys = ['cooperative.name', 'cooperative.address', 'cooperative.cuit'];

settingsRouter.get(
  '/public',
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    const data = Object.fromEntries(
      Object.entries(settings).filter(([key]) => publicKeys.includes(key)),
    );
    res.json({
      cooperativeName: data['cooperative.name'] ?? 'Cooperadora Escolar',
      address: data['cooperative.address'] ?? '',
      cuit: data['cooperative.cuit'] ?? '',
    });
  }),
);

settingsRouter.use(authenticate);

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ data: await getSettings() });
  }),
);

settingsRouter.put(
  '/',
  authorize('ADMIN'),
  validateBody(z.record(z.string().trim().min(1).max(80), z.string().max(2000))),
  asyncHandler(async (req, res) => {
    const values = req.body as Record<string, string>;
    await upsertSettings(values);
    res.json({ data: await getSettings() });
  }),
);
