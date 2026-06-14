import { Router } from 'express';
import { z } from 'zod';
import { getContainer } from '../config/di.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { reqMeta } from '../utils/reqMeta.js';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  clearAuthCookies,
  setAccessCookie,
  setCsrfCookie,
  setRefreshCookie,
} from '../utils/cookies.js';
import { Errors } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { authEmailLimiter, authIpLimiter } from '../middleware/rateLimit.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { registerUser } from '../services/auth/register.service.js';
import { verifyEmail } from '../services/auth/verifyEmail.service.js';
import { loginUser } from '../services/auth/login.service.js';
import { refreshSession } from '../services/auth/refresh.service.js';
import { logoutSession } from '../services/auth/logout.service.js';
import { startPasswordReset } from '../services/auth/forgotPassword.service.js';
import { resetPassword } from '../services/auth/resetPassword.service.js';
import { toPublicUser } from '../services/auth/types.js';

export const authRouter = Router();

// bcrypt acepta máximo 72 bytes en el input; capeamos antes de hash para
// evitar truncamiento silencioso. Mínimo 8 caracteres (NIST 800-63B).
const passwordSchema = z.string().min(8, 'Mínimo 8 caracteres').max(72, 'Máximo 72 caracteres');

const emailSchema = z.string().email().max(254);

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(2).max(80),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

const verifyEmailSchema = z.object({
  token: z.string().min(32).max(128),
});

const forgotSchema = z.object({
  email: emailSchema,
});

const resetSchema = z.object({
  token: z.string().min(32).max(128),
  newPassword: passwordSchema,
});

authRouter.post(
  '/auth/register',
  authIpLimiter,
  authEmailLimiter,
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const { prisma, email } = getContainer();
    const user = await registerUser({ prisma, email }, input, reqMeta(req));
    res.status(201).json({ data: { user } });
  }),
);

authRouter.post(
  '/auth/verify-email',
  authIpLimiter,
  asyncHandler(async (req, res) => {
    const { token } = verifyEmailSchema.parse(req.body);
    const { prisma } = getContainer();
    const user = await verifyEmail({ prisma }, token, reqMeta(req));
    res.status(200).json({ data: { user } });
  }),
);

authRouter.post(
  '/auth/login',
  authIpLimiter,
  authEmailLimiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const { prisma, email } = getContainer();
    const result = await loginUser({ prisma, email }, input, reqMeta(req));
    setAccessCookie(res, result.accessToken);
    setRefreshCookie(res, result.refreshToken);
    setCsrfCookie(res, result.csrfToken);
    res.status(200).json({ data: { user: result.user, csrfToken: result.csrfToken } });
  }),
);

authRouter.post(
  '/auth/refresh',
  authIpLimiter,
  asyncHandler(async (req, res) => {
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    const token = cookies[REFRESH_COOKIE_NAME];
    if (!token) throw Errors.unauthorized('Sesión expirada');
    const { prisma } = getContainer();
    const result = await refreshSession({ prisma }, token, reqMeta(req));
    setAccessCookie(res, result.accessToken);
    setRefreshCookie(res, result.refreshToken);
    setCsrfCookie(res, result.csrfToken);
    res.status(200).json({ data: { user: result.user, csrfToken: result.csrfToken } });
  }),
);

authRouter.post(
  '/auth/logout',
  asyncHandler(async (req, res) => {
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    const refresh = cookies[REFRESH_COOKIE_NAME];
    const access = cookies[ACCESS_COOKIE_NAME];

    // Tomamos userId del access token si está presente, sin tirar 401 si
    // expiró — logout debe funcionar incluso con sesión vencida.
    let userId: string | null = null;
    if (access) {
      try {
        userId = verifyAccessToken(access).sub;
      } catch {
        userId = null;
      }
    }

    const { prisma } = getContainer();
    await logoutSession({ prisma }, refresh, userId, reqMeta(req));
    clearAuthCookies(res);
    res.status(204).end();
  }),
);

authRouter.post(
  '/auth/forgot-password',
  authIpLimiter,
  authEmailLimiter,
  asyncHandler(async (req, res) => {
    const { email } = forgotSchema.parse(req.body);
    const { prisma, email: emailService } = getContainer();
    await startPasswordReset({ prisma, email: emailService }, email, reqMeta(req));
    res.status(204).end();
  }),
);

authRouter.post(
  '/auth/reset-password',
  authIpLimiter,
  asyncHandler(async (req, res) => {
    const input = resetSchema.parse(req.body);
    const { prisma } = getContainer();
    await resetPassword({ prisma }, input, reqMeta(req));
    res.status(200).json({ data: { ok: true } });
  }),
);

authRouter.get(
  '/auth/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw Errors.unauthorized();
    const { prisma } = getContainer();
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.deletedAt) throw Errors.unauthorized('Sesión inválida');
    res.status(200).json({ data: { user: toPublicUser(user) } });
  }),
);
