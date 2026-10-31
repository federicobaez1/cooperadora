import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodTypeAny } from 'zod';
import { HttpError } from '../utils/http-error';

export const validateBody = (schema: ZodTypeAny): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new HttpError(400, 'Datos inválidos', result.error.flatten()));
      return;
    }
    req.body = result.data;
    next();
  };
};

export const parseQuery = <T>(schema: ZodTypeAny, req: Request): T => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    throw new HttpError(400, 'Parámetros inválidos', result.error.flatten());
  }
  return result.data as T;
};

export const parseParams = <T>(schema: ZodTypeAny, req: Request): T => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    throw new HttpError(400, 'Parámetros inválidos', result.error.flatten());
  }
  return result.data as T;
};
