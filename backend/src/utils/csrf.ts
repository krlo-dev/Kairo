import { randomToken } from './crypto.js';

// CSRF double-submit: el servidor genera un token random y lo manda en dos
// canales — una cookie no-httpOnly (legible por JS del front) y un header
// X-CSRF-Token. El middleware compara ambos en cada mutation.

export const CSRF_COOKIE_NAME = 'csrfToken';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export function newCsrfToken(): string {
  return randomToken(32);
}

// Comparación constante en longitud para evitar timing attacks; ambos son
// strings hex generados por randomToken, longitud fija (64).
export function csrfTokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
