import type { CookieOptions, Response } from 'express';
import { env, isProduction } from '../config/env.js';
import { CSRF_COOKIE_NAME } from './csrf.js';

export const ACCESS_COOKIE_NAME = 'accessToken';
export const REFRESH_COOKIE_NAME = 'refreshToken';

// 15 minutos y 7 días en ms — alineado con JWT_ACCESS_TTL / JWT_REFRESH_TTL
// por defecto. Si esos cambian via env, los cookies expiran antes que el JWT
// (peor caso: usuario es deslogueado un poco antes; el JWT seguiría siendo
// criptográficamente válido pero ya no se enviará).
const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function baseCookie(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setAccessCookie(res: Response, token: string): void {
  res.cookie(ACCESS_COOKIE_NAME, token, {
    ...baseCookie(),
    maxAge: ACCESS_MAX_AGE_MS,
  });
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseCookie(),
    maxAge: REFRESH_MAX_AGE_MS,
    // Scope al endpoint de refresh para minimizar exposición. Logout también
    // debe poder limpiarlo, así que se incluye en su path raíz manualmente.
    path: '/api/auth',
  });
}

// CSRF token va en cookie NO httpOnly para que el frontend pueda leerlo y
// reenviarlo en el header X-CSRF-Token (patrón double-submit).
export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE_NAME, token, {
    ...baseCookie(),
    httpOnly: false,
    maxAge: REFRESH_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  const base = baseCookie();
  res.clearCookie(ACCESS_COOKIE_NAME, base);
  res.clearCookie(REFRESH_COOKIE_NAME, { ...base, path: '/api/auth' });
  res.clearCookie(CSRF_COOKIE_NAME, { ...base, httpOnly: false });
}
