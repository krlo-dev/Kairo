import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshExpiringTokensOnce } from '../../../src/jobs/tokenRefresh.job.js';
import { decrypt, encrypt } from '../../../src/utils/crypto.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { setupUndiciMock, type MockSetup } from '../../helpers/undiciMock.js';

interface PrismaWithMl extends PrismaMock {
  mLOAuthToken: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

function withMl(prisma: PrismaMock): PrismaWithMl {
  const ex = prisma as PrismaWithMl;
  ex.mLOAuthToken = { findMany: vi.fn(), update: vi.fn().mockResolvedValue({ id: 'ok' }) };
  return ex;
}

describe('refreshExpiringTokensOnce', () => {
  const ORIGIN = 'https://api.mercadolibre.com';
  let prisma: PrismaWithMl;
  let mock: MockSetup;

  beforeEach(() => {
    process.env.ML_APP_ID = process.env.ML_APP_ID ?? 'app-id-test';
    process.env.ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET ?? 'client-secret-test';
    prisma = withMl(createPrismaMock());
    mock = setupUndiciMock(ORIGIN);
  });
  afterEach(() => {
    mock.restore();
  });

  it('refresca los tokens por vencer y guarda los nuevos cifrados', async () => {
    prisma.mLOAuthToken.findMany.mockResolvedValueOnce([
      {
        id: 'tok-1',
        userId: 'u1',
        accessTokenEncrypted: encrypt('OLD-AT'),
        refreshTokenEncrypted: encrypt('OLD-RT'),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        mlUserId: '111',
        scope: 'read',
      },
    ]);
    mock.pool.intercept({ path: '/oauth/token', method: 'POST' }).reply(200, {
      access_token: 'NEW-AT',
      refresh_token: 'NEW-RT',
      token_type: 'bearer',
      expires_in: 21600,
      scope: 'offline_access read',
    });

    const result = await refreshExpiringTokensOnce({ prisma: asPrisma(prisma) });

    expect(result).toEqual({ scanned: 1, refreshed: 1, failed: 0 });
    const updateArg = prisma.mLOAuthToken.update.mock.calls[0]?.[0] as {
      data: { accessTokenEncrypted: string; refreshTokenEncrypted: string };
    };
    expect(decrypt(updateArg.data.accessTokenEncrypted)).toBe('NEW-AT');
    expect(decrypt(updateArg.data.refreshTokenEncrypted)).toBe('NEW-RT');
  });

  it('error en un token no detiene el batch', async () => {
    prisma.mLOAuthToken.findMany.mockResolvedValueOnce([
      {
        id: 'tok-bad',
        userId: 'u1',
        accessTokenEncrypted: encrypt('AT-1'),
        refreshTokenEncrypted: encrypt('RT-1'),
        expiresAt: new Date(),
        mlUserId: '111',
        scope: null,
      },
      {
        id: 'tok-good',
        userId: 'u2',
        accessTokenEncrypted: encrypt('AT-2'),
        refreshTokenEncrypted: encrypt('RT-2'),
        expiresAt: new Date(),
        mlUserId: '222',
        scope: null,
      },
    ]);
    // primer call falla (400 = no retry)
    mock.pool.intercept({ path: '/oauth/token', method: 'POST' }).reply(400, 'invalid_grant');
    // segundo call funciona
    mock.pool.intercept({ path: '/oauth/token', method: 'POST' }).reply(200, {
      access_token: 'NEW-AT-2',
      refresh_token: 'NEW-RT-2',
      token_type: 'bearer',
      expires_in: 21600,
    });

    const result = await refreshExpiringTokensOnce({ prisma: asPrisma(prisma) });
    expect(result).toEqual({ scanned: 2, refreshed: 1, failed: 1 });
  });

  it('batch vacío (sin tokens por vencer) devuelve scanned=0', async () => {
    prisma.mLOAuthToken.findMany.mockResolvedValueOnce([]);
    const result = await refreshExpiringTokensOnce({ prisma: asPrisma(prisma) });
    expect(result).toEqual({ scanned: 0, refreshed: 0, failed: 0 });
    expect(prisma.mLOAuthToken.update).not.toHaveBeenCalled();
  });
});
