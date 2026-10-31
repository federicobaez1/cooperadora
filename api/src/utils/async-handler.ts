import { NextFunction, Request, RequestHandler, Response } from 'express';

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

export const asyncHandler = (fn: Handler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
