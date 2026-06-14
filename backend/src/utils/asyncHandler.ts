import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

// Wraps an async route/middleware so rejections propagate to Express errorHandler.
export function asyncHandler(fn: AsyncFn): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
