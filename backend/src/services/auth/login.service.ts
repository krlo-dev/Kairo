import type { PrismaClient, User } from '@prisma/client';
import type { EmailService } from '../../interfaces/EmailService.js';
import { verifyPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';
import { randomToken, sha256 } from '../../utils/crypto.js';
import { newCsrfToken } from '../../utils/csrf.js';
import { recordAudit } from '../../utils/auditLog.js';
import { Errors } from '../../utils/errors.js';
import { toPublicUser, type PublicUser, type RequestMeta } from './types.js';

// 5 intentos fallidos → bloqueo 15 min. Espec: sección 9.7.
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

export interface LoginDeps {
  prisma: PrismaClient;
  email: EmailService;
}

export async function loginUser(
  deps: LoginDeps,
  input: LoginInput,
  meta: RequestMeta = {},
): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  const user = await deps.prisma.user.findUnique({ where: { email } });

  // Mensaje genérico para no revelar si el email existe (anti-enumeration).
  const genericError = Errors.unauthorized('Email o contraseña incorrectos');

  if (!user || user.deletedAt) {
    await recordAudit(deps.prisma, {
      action: 'auth.login_failed',
      ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
      ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
      metadata: { reason: 'no_user' },
    });
    throw genericError;
  }

  // Lockout activo
  if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
    throw Errors.forbidden(
      'Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en unos minutos',
    );
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    await handleFailedAttempt(deps, user, meta);
    throw genericError;
  }

  if (!user.emailVerified) {
    throw Errors.forbidden('Confirma tu email antes de iniciar sesión');
  }

  // Login exitoso — reset lockout + emit tokens.
  // Refresh token = opaco random (48 bytes); en DB guardamos sha256(raw)
  // como tokenHash (SPEC §9.3). Cada uso del refresh rota: revokedAt al
  // anterior + crea uno nuevo. Si la DB se filtra, los hashes no permiten
  // reusar tokens.
  const refreshTokenRaw = randomToken(48);
  const refreshTokenHash = sha256(refreshTokenRaw);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await deps.prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: refreshExpiresAt,
      ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
      ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
    },
  });

  await deps.prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  const accessToken = signAccessToken({ sub: user.id, plan: user.plan });
  const csrfToken = newCsrfToken();

  await recordAudit(deps.prisma, {
    userId: user.id,
    action: 'auth.login_success',
    ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
    ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
  });

  return {
    user: toPublicUser(user),
    accessToken,
    refreshToken: refreshTokenRaw,
    csrfToken,
  };
}

async function handleFailedAttempt(deps: LoginDeps, user: User, meta: RequestMeta): Promise<void> {
  const attempts = user.failedLoginAttempts + 1;
  const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
  const unlockAt = shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null;

  await deps.prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: shouldLock ? 0 : attempts,
      accountLockedUntil: unlockAt,
    },
  });

  await recordAudit(deps.prisma, {
    userId: user.id,
    action: 'auth.login_failed',
    ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
    ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
    metadata: { attempts, locked: shouldLock },
  });

  if (shouldLock && unlockAt) {
    try {
      await deps.email.sendAccountLocked({
        to: user.email,
        name: user.name,
        unlockAt,
      });
    } catch {
      // Email es best-effort; el lockout ya se aplicó en DB.
    }
  }
}
