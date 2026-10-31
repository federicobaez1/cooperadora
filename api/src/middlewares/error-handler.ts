import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error';

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ message: 'Ruta no encontrada' });
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message, details: error.details });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({ message: 'Datos inválidos', details: error.flatten() });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({ message: 'Ya existe un registro con esos datos', details: error.meta });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ message: 'Registro no encontrado' });
      return;
    }
    if (error.code === 'P2003') {
      res.status(409).json({ message: 'El registro tiene movimientos asociados y no se puede eliminar' });
      return;
    }
  }

  console.error('[error]', error);
  res.status(500).json({ message: 'Error interno del servidor' });
};
