import type { PrismaClient } from '@prisma/client';
import { signAccessToken } from '../../utils/jwt.js';
import { randomToken, sha256 } from '../../utils/crypto.js';
import { newCsrfToken } from '../../utils/csrf.js';
import { recordAudit } from '../../utils/auditLog.js';
import { Errors } from '../../utils/errors.js';
import { logger } from '../../logger/pino.js';
import { toPublicUser, type PublicUser, type RequestMeta } from './types.js';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface RefreshDeps {
  prisma: PrismaClient;
}

export interface RefreshResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

export async function refreshSession(
  deps: RefreshDeps,
  rawToken: string,
  meta: RequestMeta = {},
): Promise<RefreshResult> {
  const tokenHash = sha256(rawToken);

  const record = await deps.prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    throw Errors.unauthorized('Sesión expirada — vuelve a iniciar sesión');
  }

  // Detección de reuse: si el token ya fue revocado, alguien lo está usando
  // por segunda vez. Asumimos compromiso → revocamos toda la familia del
  // usuario para forzar relogin en todos los dispositivos.
  if (record.revokedAt) {
    await deps.prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAudit(deps.prisma, {
      userId: record.userId,
      action: 'auth.refresh_reuse_detected',
      ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
      ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
    });
    logger.warn(
      { userId: record.userId, refreshTokenId: record.id },
      'refresh token reuse — revoked all sessions',
    );
    throw Errors.unauthorized('Sesión inválida — vuelve a iniciar sesión');
  }

  // Rotation: revoca el actual y emite uno nuevo enlazado vía replacedBy.
  const newRaw = randomToken(48);
  const newHash = sha256(newRaw);
  const newExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await deps.prisma.$transaction(async (tx) => {
    const created = await tx.refreshToken.create({
      data: {
        userId: record.userId,
        tokenHash: newHash,
        expiresAt: newExpiresAt,
        ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
        ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
      },
    });
    await tx.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedBy: created.id },
    });
  });

  const accessToken = signAccessToken({
    sub: record.user.id,
    plan: record.user.plan,
  });
  const csrfToken = newCsrfToken();

  return {
    user: toPublicUser(record.user),
    accessToken,
    refreshToken: newRaw,
    csrfToken,
  };
}
