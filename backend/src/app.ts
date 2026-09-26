import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import {
  csrfProtect,
  errorHandler,
  notFoundHandler,
  requestContext,
  requestLogger,
} from './middleware/index.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { mlRouter } from './routes/ml.routes.js';
import { searchRouter } from './routes/search.routes.js';
import { trackingRouter } from './routes/tracking.routes.js';
import { env } from './config/env.js';

export function createApp(): Express {
  const app = express();

  // Trust proxy (Hostinger/Passenger sits behind a load balancer / Cloudflare)
  app.set('trust proxy', 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://plausible.io'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: [
            "'self'",
            'https://*.sentry.io',
            'https://plausible.io',
            'https://api.mercadolibre.com',
            'https://api.mercadopago.com',
          ],
          frameAncestors: ["'none'"],
        },
      },
      hsts: {
        maxAge: 63072000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // CORS — whitelist exacta
  app.use(
    cors({
      origin: [env.FRONTEND_URL, env.APP_URL].filter(Boolean),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-ID'],
    }),
  );

  // Body parsing — raw body conservado en webhooks
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Request context + logging
  app.use(requestContext);
  app.use(requestLogger);

  // CSRF protection — corre antes de las rutas mutables.
  app.use('/api', csrfProtect);

  // Routes
  app.use('/api', healthRouter);
  app.use('/api', authRouter);
  app.use('/api', mlRouter);
  app.use('/api', searchRouter);
  app.use('/api', trackingRouter);

  // 404 + error handler
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
