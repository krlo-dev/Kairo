import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { logger } from '../logger/pino.js';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    log: typeof logger;
  }
}

export const requestContext: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const requestId = incoming && incoming.length < 128 ? incoming : randomUUID();
  req.requestId = requestId;
  req.log = logger.child({ requestId });
  res.setHeader('x-request-id', requestId);
  next();
};

export const requestLogger: RequestHandler = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    req.log.info(
      {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs,
      },
      'request',
    );
  });
  next();
};
