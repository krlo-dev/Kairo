import type { PrismaClient } from '@prisma/client';
import { sha256 } from '../../utils/crypto.js';
import { recordAudit } from '../../utils/auditLog.js';
import { Errors } from '../../utils/errors.js';
import { toPublicUser, type PublicUser, type RequestMeta } from './types.js';

export interface VerifyEmailDeps {
  prisma: PrismaClient;
}

export async function verifyEmail(
  deps: VerifyEmailDeps,
  token: string,
  meta: RequestMeta = {},
): Promise<PublicUser> {
  const tokenHash = sha256(token);

  const record = await deps.prisma.emailVerification.findUnique({
    where: { tokenHash },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw Errors.validation('Enlace de verificación inválido o caducado');
  }

  const user = await deps.prisma.$transaction(async (tx) => {
    await tx.emailVerification.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return tx.user.update({
      where: { id: record.userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });
  });

  await recordAudit(deps.prisma, {
    userId: user.id,
    action: 'auth.verify_email',
    ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
    ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
  });

  return toPublicUser(user);
}
