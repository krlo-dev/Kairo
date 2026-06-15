import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizeUrl,
  disconnectMl,
  handleOAuthCallback,
  newOAuthState,
} from '../../../src/services/mercadolibre/oauth.service.js';
import { decrypt } from '../../../src/utils/crypto.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { setupUndiciMock, type MockSetup } from '../../helpers/undiciMock.js';

interface PrismaWithMl extends PrismaMock {
  mLOAuthToken: {
    upsert: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
}

function withMl(prisma: PrismaMock): PrismaWithMl {
  const extended = prisma as PrismaWithMl;
  extended.mLOAuthToken = {
    upsert: vi.fn().mockResolvedValue({ id: 'tok1' }),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  return extended;
}

describe('ML OAuth service', () => {
  beforeEach(() => {
    process.env.ML_APP_ID = process.env.ML_APP_ID ?? 'app-id-test';
    process.env.ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET ?? 'client-secret-test';
    process.env.ML_REDIRECT_URI =
      process.env.ML_REDIRECT_URI ?? 'http://localhost:3000/api/auth/ml/callback';
  });

  describe('buildAuthorizeUrl', () => {
    it('arma URL con state + PKCE S256 correctos', () => {
      const state = newOAuthState();
      const url = new URL(buildAuthorizeUrl(state));
      expect(url.origin + url.pathname).toBe('https://auth.mercadolibre.com.co/authorization');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('state')).toBe(state.state);
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      const expectedChallenge = createHash('sha256')
        .update(state.codeVerifier)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
      expect(url.searchParams.get('code_challenge')).toBe(expectedChallenge);
    });
  });

  describe('handleOAuthCallback', () => {
    let prisma: PrismaWithMl;
    let mock: MockSetup;

    beforeEach(() => {
      prisma = withMl(createPrismaMock());
      mock = setupUndiciMock('https://api.mercadolibre.com');
    });
    afterEach(() => {
      mock.restore();
    });

    it('rechaza state mismatch', async () => {
      const state = newOAuthState();
      await expect(
        handleOAuthCallback(
          { prisma: asPrisma(prisma) },
          {
            userId: 'u1',
            code: 'auth-code',
            stateFromQuery: 'NOT-THE-SAME',
            stateFromCookie: state,
          },
        ),
      ).rejects.toMatchObject({ code: 'ml_state_mismatch' });
    });

    it('rechaza state expirado', async () => {
      const state = newOAuthState();
      state.expiresAt = Date.now() - 1000;
      await expect(
        handleOAuthCallback(
          { prisma: asPrisma(prisma) },
          {
            userId: 'u1',
            code: 'auth-code',
            stateFromQuery: state.state,
            stateFromCookie: state,
          },
        ),
      ).rejects.toMatchObject({ code: 'ml_state_expired' });
    });

    it('intercambia code → tokens y persiste cifrados', async () => {
      const state = newOAuthState();
      mock.pool.intercept({ path: '/oauth/token', method: 'POST' }).reply(200, {
        access_token: 'AT-12345',
        refresh_token: 'RT-67890',
        token_type: 'bearer',
        expires_in: 21600,
        scope: 'offline_access read write',
        user_id: 999888,
      });

      const out = await handleOAuthCallback(
        { prisma: asPrisma(prisma) },
        {
          userId: 'u1',
          code: 'auth-code',
          stateFromQuery: state.state,
          stateFromCookie: state,
        },
      );

      expect(out.mlUserId).toBe('999888');
      const callArg = prisma.mLOAuthToken.upsert.mock.calls[0]?.[0] as {
        create: { accessTokenEncrypted: string; refreshTokenEncrypted: string };
      };
      expect(decrypt(callArg.create.accessTokenEncrypted)).toBe('AT-12345');
      expect(decrypt(callArg.create.refreshTokenEncrypted)).toBe('RT-67890');
    });
  });

  describe('disconnectMl', () => {
    it('borra MLOAuthToken del user', async () => {
      const prisma = withMl(createPrismaMock());
      await disconnectMl({ prisma: asPrisma(prisma) }, 'u1');
      expect(prisma.mLOAuthToken.deleteMany.mock.calls[0]?.[0]).toMatchObject({
        where: { userId: 'u1' },
      });
    });
  });
});
