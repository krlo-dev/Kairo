import { beforeEach, describe, expect, it } from 'vitest';
import { verifyEmail } from '../../../src/services/auth/verifyEmail.service.js';
import { sha256 } from '../../../src/utils/crypto.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { buildUser } from '../../fixtures/userFactory.js';

const TOKEN = 'b'.repeat(64);

describe('verifyEmail', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('marca emailVerified=true cuando el token es válido', async () => {
    const user = buildUser({ emailVerified: false });
    prisma.emailVerification.findUnique.mockResolvedValueOnce({
      id: 'ev1',
      userId: user.id,
      tokenHash: sha256(TOKEN),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
    });
    prisma.user.update.mockResolvedValueOnce(buildUser({ ...user, emailVerified: true }));

    const result = await verifyEmail({ prisma: asPrisma(prisma) }, TOKEN);

    expect(result.emailVerified).toBe(true);
    expect(prisma.emailVerification.update).toHaveBeenCalled();
  });

  it('rechaza token usado o caducado', async () => {
    prisma.emailVerification.findUnique.mockResolvedValueOnce({
      id: 'ev1',
      userId: 'u1',
      tokenHash: sha256(TOKEN),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: new Date(),
    });
    await expect(verifyEmail({ prisma: asPrisma(prisma) }, TOKEN)).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('rechaza token desconocido', async () => {
    prisma.emailVerification.findUnique.mockResolvedValueOnce(null);
    await expect(verifyEmail({ prisma: asPrisma(prisma) }, TOKEN)).rejects.toMatchObject({
      statusCode: 422,
    });
  });
});
