import { httpRequest } from '../../utils/httpClient.js';
import { env } from '../../config/env.js';
import { logger } from '../../logger/pino.js';
import { AppError } from '../../utils/errors.js';

// App-only token (Client Credentials grant). Sirve para llamar a endpoints
// publicos de ML (`/sites/MCO/search`, `/items/:id`) sin OAuth de usuario.
// Lo cacheamos en memoria del proceso — al reiniciar se vuelve a pedir.
//
// Refresh on-demand: si una llamada upstream devuelve 401, el caller llama
// `invalidate()` y la siguiente solicitud genera un token nuevo.

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

const ML_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
// Margen de seguridad: refrescamos `EXPIRE_MARGIN_MS` antes de la expiracion real
// para evitar usar un token que acaba de vencer entre el getToken() y el request.
const EXPIRE_MARGIN_MS = 5 * 60 * 1000;

let cache: CachedToken | null = null;
let inFlight: Promise<string> | null = null;

function isFresh(c: CachedToken | null): c is CachedToken {
  return c !== null && c.expiresAt > Date.now() + EXPIRE_MARGIN_MS;
}

async function fetchNewToken(): Promise<string> {
  if (!env.ML_APP_ID || !env.ML_CLIENT_SECRET) {
    throw new AppError(
      'ml_credentials_missing',
      500,
      'ML_APP_ID y ML_CLIENT_SECRET son requeridos para llamadas a Mercado Libre',
    );
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.ML_APP_ID,
    client_secret: env.ML_CLIENT_SECRET,
  }).toString();

  const res = await httpRequest<TokenResponse>(ML_TOKEN_URL, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });

  cache = {
    token: res.data.access_token,
    expiresAt: Date.now() + res.data.expires_in * 1000,
  };
  logger.info(
    { expiresIn: res.data.expires_in, scope: res.data.scope },
    'ml app-only token issued',
  );
  return cache.token;
}

export async function getAppToken(): Promise<string> {
  if (isFresh(cache)) return cache.token;
  // Coalescing: si N callers piden token a la vez, solo disparamos UN request.
  if (!inFlight) {
    inFlight = fetchNewToken().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export function invalidateAppToken(): void {
  cache = null;
}

// Solo para tests.
export function _resetAppToken(): void {
  cache = null;
  inFlight = null;
}
