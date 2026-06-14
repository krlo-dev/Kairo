import type { PrismaClient } from '@prisma/client';
import type { EmailService } from '../../interfaces/EmailService.js';
import { randomToken, sha256 } from '../../utils/crypto.js';
import { recordAudit } from '../../utils/auditLog.js';
import { env } from '../../config/env.js';
import type { RequestMeta } from './types.js';

const RESET_TTL_MS = 60 * 60 * 1000; // 1h

export interface ForgotPasswordDeps {
  prisma: PrismaClient;
  email: EmailService;
}

// Importante: este servicio NUNCA debe revelar si el email existe o no
// (anti-enumeration). El caller debe responder 204 siempre, sin importar
// si encontró un user.
export async function startPasswordReset(
  deps: ForgotPasswordDeps,
  emailInput: string,
  meta: RequestMeta = {},
): Promise<void> {
  const email = emailInput.trim().toLowerCase();
  const user = await deps.prisma.user.findUnique({ where: { email } });

  if (!user || user.deletedAt) return;

  const token = randomToken(32);
  const tokenHash = sha256(token);

  await deps.prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });

  const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${token}`;

  try {
    await deps.email.sendPasswordReset({
      to: user.email,
      name: user.name,
      resetUrl,
    });
  } catch {
    // El email puede fallar; el token ya quedó en DB. El user verá un
    // mensaje genérico y podrá reintentar.
  }

  await recordAudit(deps.prisma, {
    userId: user.id,
    action: 'auth.forgot_password_requested',
    ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
    ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
  });
}
