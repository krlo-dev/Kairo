import { Router } from 'express';
import { z } from 'zod';
import { getContainer } from '../config/di.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { reqMeta } from '../utils/reqMeta.js';
import { Errors } from '../utils/errors.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  buildAuthorizeUrl,
  disconnectMl,
  handleOAuthCallback,
  newOAuthState,
  type MlOAuthState,
} from '../services/mercadolibre/oauth.service.js';
import { env, isProduction } from '../config/env.js';

export const mlRouter = Router();

// Cookie httpOnly que viaja entre /connect y /callback con state + PKCE verifier.
// TTL corto (5 min) — solo necesita sobrevivir el redirect a ML y volver.
const ML_OAUTH_COOKIE = 'ml_oauth';
const ML_OAUTH_TTL_MS = 5 * 60 * 1000;

const callbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

mlRouter.get(
  '/auth/ml/connect',
  requireAuth,
  asyncHandler((req, res) => {
    if (!req.user) throw Errors.unauthorized();
    const state = newOAuthState();
    const authorizeUrl = buildAuthorizeUrl(state);

    res.cookie(ML_OAUTH_COOKIE, JSON.stringify(state), {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth/ml',
      maxAge: ML_OAUTH_TTL_MS,
      ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    });
    res.redirect(302, authorizeUrl);
    return Promise.resolve();
  }),
);

mlRouter.get(
  '/auth/ml/callback',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw Errors.unauthorized();
    const { code, state } = callbackSchema.parse(req.query);

    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    const cookieRaw = cookies[ML_OAUTH_COOKIE];
    if (!cookieRaw) throw Errors.validation('Sesión de autorización ausente');

    let stateFromCookie: MlOAuthState;
    try {
      stateFromCookie = JSON.parse(cookieRaw) as MlOAuthState;
    } catch {
      throw Errors.validation('Sesión de autorización corrupta');
    }

    const { prisma } = getContainer();
    await handleOAuthCallback(
      { prisma },
      { userId: req.user.id, code, stateFromQuery: state, stateFromCookie },
      reqMeta(req),
    );

    // Limpia la cookie corta y redirige al frontend.
    res.clearCookie(ML_OAUTH_COOKIE, { path: '/api/auth/ml' });
    const successUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/settings?ml=connected`;
    res.redirect(302, successUrl);
  }),
);

mlRouter.delete(
  '/auth/ml',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw Errors.unauthorized();
    const { prisma } = getContainer();
    await disconnectMl({ prisma }, req.user.id, reqMeta(req));
    res.status(204).end();
  }),
);
