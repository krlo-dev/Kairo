import type { RequestHandler } from 'express';
import type { Plan } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt.js';
import { ACCESS_COOKIE_NAME } from '../utils/cookies.js';
import { Errors } from '../utils/errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; plan: Plan };
  }
}

// Verifica el accessToken (JWT en cookie httpOnly) y deja req.user.
// Tirar 401 cuando falta o es inválido — el frontend captura el 401 y
// dispara el flow de refresh.
export const requireAuth: RequestHandler = (req, _res, next) => {
  const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
  const token = cookies[ACCESS_COOKIE_NAME];
  if (!token) {
    next(Errors.unauthorized('Sesión requerida'));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, plan: payload.plan };
    next();
  } catch (err) {
    next(err);
  }
};
