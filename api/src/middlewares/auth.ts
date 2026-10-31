import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { HttpError } from '../utils/http-error';

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new HttpError(401, 'Token no proporcionado');
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & { sub?: string };

    if (!payload.sub) {
      throw new HttpError(401, 'Token inválido');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) {
      throw new HttpError(401, 'Usuario no válido o inactivo');
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
      return;
    }
    next(new HttpError(401, 'Token inválido o expirado'));
  }
};

export const authorize = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new HttpError(401, 'No autenticado'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, 'No tenés permisos para realizar esta acción'));
      return;
    }
    next();
  };
};
