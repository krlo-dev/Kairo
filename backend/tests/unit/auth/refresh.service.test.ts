import { beforeEach, describe, expect, it } from 'vitest';
import { refreshSession } from '../../../src/services/auth/refresh.service.js';
import { sha256 } from '../../../src/utils/crypto.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { buildUser } from '../../fixtures/userFactory.js';

const RAW = 'a'.repeat(96); // 48 bytes hex

describe('refreshSession', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('rota el token: revoca el actual y emite uno nuevo', async () => {
    const user = buildUser();
    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      id: 'rt-old',
      userId: user.id,
      tokenHash: sha256(RAW),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      revokedAt: null,
      user,
    });
    prisma.refreshToken.create.mockResolvedValueOnce({ id: 'rt-new' });

    const result = await refreshSession({ prisma: asPrisma(prisma) }, RAW);

    expect(result.refreshToken).not.toBe(RAW);
    expect(result.refreshToken).toMatch(/^[0-9a-f]{96}$/);
    expect(result.accessToken).toBeTruthy();
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt-old' },
        data: expect.objectContaining({ replacedBy: 'rt-new' }) as unknown,
      }),
    );
  });

  it('token expirado devuelve 401', async () => {
    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      id: 'rt-x',
      userId: 'u1',
      tokenHash: sha256(RAW),
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      user: buildUser(),
    });

    await expect(refreshSession({ prisma: asPrisma(prisma) }, RAW)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('token desconocido devuelve 401', async () => {
    prisma.refreshToken.findUnique.mockResolvedValueOnce(null);
    await expect(refreshSession({ prisma: asPrisma(prisma) }, RAW)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('detecta reuse de token revocado y revoca toda la familia', async () => {
    const user = buildUser();
    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      id: 'rt-revoked',
      userId: user.id,
      tokenHash: sha256(RAW),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      revokedAt: new Date(),
      user,
    });

    await expect(refreshSession({ prisma: asPrisma(prisma) }, RAW)).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: user.id, revokedAt: null },
      }),
    );
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });
});
