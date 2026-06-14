import rateLimit, { type Options } from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env.js';

const errorResponse: Options['handler'] = (_req, res) => {
  res.status(429).json({
    error: {
      code: 'rate_limited',
      message: 'Demasiadas solicitudes. Espera unos minutos e intenta de nuevo',
    },
  });
};

// Rate limit por IP para todos los endpoints de auth (login, register, etc).
// 10 req / 15 min por IP. SPEC §9.18.
export const authIpLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: errorResponse,
});

// Rate limit por email — 5 req / 15 min por email (login, forgot, reset).
// Necesario para evitar brute force sobre un email específico desde IPs
// distintas. La key es lowercased.
export const authEmailLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const body = (req.body ?? {}) as { email?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    return `email:${email || 'anon'}`;
  },
  skip: (req: Request) => {
    const body = (req.body ?? {}) as { email?: unknown };
    return typeof body.email !== 'string' || body.email.length === 0;
  },
  handler: errorResponse,
});
