import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../logger/pino.js';
import { Sentry } from '../logger/sentry.js';
import { isProduction } from '../config/env.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'validation_error',
        message: 'Datos inválidos',
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  Sentry.captureException(err);

  res.status(500).json({
    error: {
      code: 'internal_error',
      message: isProduction ? 'Error interno del servidor' : String(err),
    },
  });
};

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: `Ruta no encontrada: ${req.method} ${req.path}`,
    },
  });
};
