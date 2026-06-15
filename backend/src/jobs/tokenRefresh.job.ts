import type { PrismaClient } from '@prisma/client';
import cron, { type ScheduledTask } from 'node-cron';
import { httpRequest } from '../utils/httpClient.js';
import { decrypt, encrypt } from '../utils/crypto.js';
import { env } from '../config/env.js';
import { logger } from '../logger/pino.js';
import { recordAudit } from '../utils/auditLog.js';

// Job: refresca tokens OAuth de ML que estén por vencer (<30 min).
// Schedule: cada hora (`0 * * * *`). Errores por token no detienen el batch.
// SPEC §8.1 — "tokenRefresh.job corre cada hora; refresca tokens que expiran en <30min".

const ML_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const REFRESH_WINDOW_MS = 30 * 60 * 1000;
const SCHEDULE = '0 * * * *';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
}

export interface TokenRefreshDeps {
  prisma: PrismaClient;
}

export async function refreshExpiringTokensOnce(deps: TokenRefreshDeps): Promise<{
  scanned: number;
  refreshed: number;
  failed: number;
}> {
  if (!env.ML_APP_ID || !env.ML_CLIENT_SECRET) {
    logger.warn('tokenRefresh.job: ML credentials missing, skipping');
    return { scanned: 0, refreshed: 0, failed: 0 };
  }

  const cutoff = new Date(Date.now() + REFRESH_WINDOW_MS);
  const tokens = await deps.prisma.mLOAuthToken.findMany({
    where: { expiresAt: { lt: cutoff } },
  });

  let refreshed = 0;
  let failed = 0;

  for (const row of tokens) {
    try {
      const refreshToken = decrypt(row.refreshTokenEncrypted);
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.ML_APP_ID,
        client_secret: env.ML_CLIENT_SECRET,
        refresh_token: refreshToken,
      }).toString();

      const res = await httpRequest<TokenResponse>(ML_TOKEN_URL, {
        method: 'POST',
        body,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });

      await deps.prisma.mLOAuthToken.update({
        where: { id: row.id },
        data: {
          accessTokenEncrypted: encrypt(res.data.access_token),
          refreshTokenEncrypted: encrypt(res.data.refresh_token),
          expiresAt: new Date(Date.now() + res.data.expires_in * 1000),
          ...(res.data.scope ? { scope: res.data.scope } : {}),
        },
      });
      refreshed += 1;
    } catch (err) {
      failed += 1;
      logger.error({ err, mlOAuthTokenId: row.id, userId: row.userId }, 'token refresh failed');
      await recordAudit(deps.prisma, {
        userId: row.userId,
        action: 'ml.token_refresh_failed',
        resource: 'MLOAuthToken',
        resourceId: row.id,
        metadata: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  logger.info({ scanned: tokens.length, refreshed, failed }, 'ml token refresh batch done');
  return { scanned: tokens.length, refreshed, failed };
}

export function startTokenRefreshJob(deps: TokenRefreshDeps): ScheduledTask {
  const task = cron.schedule(
    SCHEDULE,
    () => {
      refreshExpiringTokensOnce(deps).catch((err: unknown) => {
        logger.error({ err }, 'tokenRefresh.job unhandled error');
      });
    },
    { timezone: 'America/Bogota' },
  );
  logger.info({ schedule: SCHEDULE }, 'tokenRefresh.job scheduled');
  return task;
}
