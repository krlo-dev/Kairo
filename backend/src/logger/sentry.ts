import * as Sentry from '@sentry/node';
import { env, isProduction } from '../config/env.js';
import { logger } from './pino.js';

export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    logger.info('[sentry] SENTRY_DSN no configurado — Sentry deshabilitado');
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    enabled: isProduction,
    tracesSampleRate: isProduction ? 0.1 : 0,
    sendDefaultPii: false,
  });
  logger.info('[sentry] inicializado');
}

export { Sentry };
