import type { RequestHandler } from 'express';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, csrfTokensMatch } from '../utils/csrf.js';
import { Errors } from '../utils/errors.js';

// Estos endpoints NO requieren CSRF porque crean/restauran la sesión —
// el cliente todavía no tiene cookie csrfToken. La protección efectiva
// proviene del rate-limit en estos endpoints.
const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/refresh',
]);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfProtect: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (CSRF_EXEMPT_PATHS.has(req.path)) return next();

  const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  const headerToken = req.header(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken || !csrfTokensMatch(cookieToken, headerToken)) {
    return next(Errors.forbidden('CSRF token inválido o ausente'));
  }
  next();
};
