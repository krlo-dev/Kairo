import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { encrypt, randomToken } from '../../utils/crypto.js';
import { httpRequest } from '../../utils/httpClient.js';
import { AppError } from '../../utils/errors.js';
import { recordAudit } from '../../utils/auditLog.js';
import type { RequestMeta } from '../auth/types.js';

// OAuth ML — Authorization Code + PKCE (SPEC §8.1, §9.27).
//
// Paso 1 (connect): generamos state (32 bytes) + code_verifier PKCE, los
// guardamos en cookie httpOnly corta (5min). Redirigimos a ML authorize.
// Paso 2 (callback): leemos state desde cookie, validamos contra query,
// intercambiamos code por tokens, cifra AES-256-GCM, guarda MLOAuthToken
// upsert por userId (un user, un token ML — modelo 1:1 en el schema).

const ML_AUTHORIZE_URL_CO = 'https://auth.mercadolibre.com.co/authorization';
const ML_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const STATE_TTL_MS = 5 * 60 * 1000;

export interface MlOAuthState {
  state: string;
  codeVerifier: string;
  expiresAt: number;
}

interface MlTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  user_id: number | string;
}

export function newOAuthState(): MlOAuthState {
  return {
    state: randomToken(32),
    codeVerifier: randomToken(48),
    expiresAt: Date.now() + STATE_TTL_MS,
  };
}

export function buildAuthorizeUrl(state: MlOAuthState): string {
  if (!env.ML_APP_ID) {
    throw new AppError('ml_credentials_missing', 500, 'ML_APP_ID es requerido');
  }
  if (!env.ML_REDIRECT_URI) {
    throw new AppError('ml_redirect_missing', 500, 'ML_REDIRECT_URI es requerido');
  }

  // PKCE S256: code_challenge = base64url(sha256(code_verifier)).
  const codeChallenge = sha256Base64Url(state.codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.ML_APP_ID,
    redirect_uri: env.ML_REDIRECT_URI,
    state: state.state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${ML_AUTHORIZE_URL_CO}?${params.toString()}`;
}

export interface HandleCallbackInput {
  userId: string;
  code: string;
  stateFromQuery: string;
  stateFromCookie: MlOAuthState;
}

export interface HandleCallbackDeps {
  prisma: PrismaClient;
}

export async function handleOAuthCallback(
  deps: HandleCallbackDeps,
  input: HandleCallbackInput,
  meta: RequestMeta = {},
): Promise<{ mlUserId: string }> {
  if (input.stateFromCookie.expiresAt < Date.now()) {
    throw new AppError(
      'ml_state_expired',
      400,
      'La sesión de autorización expiró. Intenta de nuevo',
    );
  }
  // Comparacion en tiempo constante para evitar timing attacks.
  if (!constantTimeEquals(input.stateFromQuery, input.stateFromCookie.state)) {
    throw new AppError('ml_state_mismatch', 400, 'Sesión de autorización inválida');
  }

  if (!env.ML_APP_ID || !env.ML_CLIENT_SECRET || !env.ML_REDIRECT_URI) {
    throw new AppError('ml_credentials_missing', 500, 'Configuración de Mercado Libre incompleta');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: env.ML_APP_ID,
    client_secret: env.ML_CLIENT_SECRET,
    code: input.code,
    redirect_uri: env.ML_REDIRECT_URI,
    code_verifier: input.stateFromCookie.codeVerifier,
  }).toString();

  const res = await httpRequest<MlTokenResponse>(ML_TOKEN_URL, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });

  const mlUserId = String(res.data.user_id);
  const expiresAt = new Date(Date.now() + res.data.expires_in * 1000);

  // Upsert por userId (relación 1:1). Si el usuario reconecta, sustituimos.
  await deps.prisma.mLOAuthToken.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      accessTokenEncrypted: encrypt(res.data.access_token),
      refreshTokenEncrypted: encrypt(res.data.refresh_token),
      expiresAt,
      mlUserId,
      scope: res.data.scope ?? null,
    },
    update: {
      accessTokenEncrypted: encrypt(res.data.access_token),
      refreshTokenEncrypted: encrypt(res.data.refresh_token),
      expiresAt,
      mlUserId,
      scope: res.data.scope ?? null,
    },
  });

  await recordAudit(deps.prisma, {
    userId: input.userId,
    action: 'ml.connected',
    resource: 'MLOAuthToken',
    resourceId: mlUserId,
    ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
    ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
  });

  return { mlUserId };
}

export interface DisconnectDeps {
  prisma: PrismaClient;
}

export async function disconnectMl(
  deps: DisconnectDeps,
  userId: string,
  meta: RequestMeta = {},
): Promise<void> {
  await deps.prisma.mLOAuthToken.deleteMany({ where: { userId } });
  await recordAudit(deps.prisma, {
    userId,
    action: 'ml.disconnected',
    ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
    ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
  });
}

function sha256Base64Url(input: string): string {
  return createHash('sha256')
    .update(input)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
