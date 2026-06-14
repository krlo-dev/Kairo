import type { PrismaClient } from '@prisma/client';
import { sha256 } from '../../utils/crypto.js';
import { recordAudit } from '../../utils/auditLog.js';
import type { RequestMeta } from './types.js';

export interface LogoutDeps {
  prisma: PrismaClient;
}

// Logout es idempotente: si el token ya no existe o ya está revocado, no
// devolvemos error — el cliente solo necesita saber que las cookies se
// pueden limpiar. Esto evita filtrar info por status codes.
export async function logoutSession(
  deps: LogoutDeps,
  rawToken: string | undefined,
  userId: string | null,
  meta: RequestMeta = {},
): Promise<void> {
  if (rawToken) {
    const tokenHash = sha256(rawToken);
    await deps.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  if (userId) {
    await recordAudit(deps.prisma, {
      userId,
      action: 'auth.logout',
      ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
      ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
    });
  }
}
