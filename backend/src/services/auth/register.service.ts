import type { PrismaClient } from '@prisma/client';
import type { EmailService } from '../../interfaces/EmailService.js';
import { hashPassword } from '../../utils/password.js';
import { randomToken, sha256 } from '../../utils/crypto.js';
import { recordAudit } from '../../utils/auditLog.js';
import { Errors } from '../../utils/errors.js';
import { env } from '../../config/env.js';
import { toPublicUser, type PublicUser, type RequestMeta } from './types.js';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface RegisterDeps {
  prisma: PrismaClient;
  email: EmailService;
}

export async function registerUser(
  deps: RegisterDeps,
  input: RegisterInput,
  meta: RequestMeta = {},
): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase();

  const existing = await deps.prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Mensaje neutro para no revelar existencia. El status 409 lo
    // diferencia del flow de login, pero el cuerpo es genérico.
    throw Errors.conflict('No pudimos crear la cuenta con esos datos');
  }

  const passwordHash = await hashPassword(input.password);

  const verifyToken = randomToken(32);
  const tokenHash = sha256(verifyToken);

  const user = await deps.prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        passwordHash,
        name: input.name.trim(),
      },
    });
    await tx.emailVerification.create({
      data: {
        userId: created.id,
        tokenHash,
        expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
      },
    });
    return created;
  });

  const verifyUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/verify-email?token=${verifyToken}`;
  await deps.email.sendVerifyEmail({
    to: user.email,
    name: user.name,
    verifyUrl,
  });

  await recordAudit(deps.prisma, {
    userId: user.id,
    action: 'auth.register',
    ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
    ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
  });

  return toPublicUser(user);
}
