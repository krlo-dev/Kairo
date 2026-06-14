import type { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../utils/password.js';
import { sha256 } from '../../utils/crypto.js';
import { recordAudit } from '../../utils/auditLog.js';
import { Errors } from '../../utils/errors.js';
import type { RequestMeta } from './types.js';

export interface ResetPasswordDeps {
  prisma: PrismaClient;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export async function resetPassword(
  deps: ResetPasswordDeps,
  input: ResetPasswordInput,
  meta: RequestMeta = {},
): Promise<void> {
  const tokenHash = sha256(input.token);
  const record = await deps.prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw Errors.validation('Enlace de restablecimiento inválido o caducado');
  }

  const passwordHash = await hashPassword(input.newPassword);

  await deps.prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await tx.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
      },
    });
    // Reset de password invalida todas las sesiones activas.
    await tx.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  await recordAudit(deps.prisma, {
    userId: record.userId,
    action: 'auth.password_reset_completed',
    ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
    ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
  });
}
