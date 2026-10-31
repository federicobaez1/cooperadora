import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { asyncHandler } from '../../utils/async-handler';
import { HttpError } from '../../utils/http-error';
import { validateBody } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/auth';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos de inicio de sesión. Probá en unos minutos.' },
});

const loginSchema = z.object({
  email: z.string().trim().email('Email inválido').max(180),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres').max(100),
});

const publicUser = (user: { id: string; name: string; email: string; role: string; active: boolean }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  active: user.active,
});

authRouter.post(
  '/login',
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.active) {
      throw new HttpError(401, 'Credenciales inválidas');
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new HttpError(401, 'Credenciales inválidas');
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] },
    );

    res.json({ token, user: publicUser(user) });
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new HttpError(404, 'Usuario no encontrado');
    res.json({ user: publicUser(user) });
  }),
);

authRouter.patch(
  '/me/password',
  authenticate,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new HttpError(404, 'Usuario no encontrado');

    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) throw new HttpError(400, 'La contraseña actual no es correcta');

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });

    res.json({ message: 'Contraseña actualizada correctamente' });
  }),
);
