import { beforeEach, describe, expect, it } from 'vitest';
import { resetPassword } from '../../../src/services/auth/resetPassword.service.js';
import { startPasswordReset } from '../../../src/services/auth/forgotPassword.service.js';
import { sha256 } from '../../../src/utils/crypto.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { createEmailMock, asEmail, type EmailMock } from '../../helpers/emailMock.js';
import { buildUser } from '../../fixtures/userFactory.js';

const TOKEN = 'c'.repeat(64);

describe('startPasswordReset', () => {
  let prisma: PrismaMock;
  let email: EmailMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    email = createEmailMock();
  });

  it('email desconocido no falla y no envía nada (anti-enumeration)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await startPasswordReset(
      { prisma: asPrisma(prisma), email: asEmail(email) },
      'unknown@kairo.com.co',
    );

    expect(email.sendPasswordReset).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('user existente crea token y envía email', async () => {
    const user = buildUser();
    prisma.user.findUnique.mockResolvedValueOnce(user);
    prisma.passwordResetToken.create.mockResolvedValueOnce({ id: 'pr1' });

    await startPasswordReset({ prisma: asPrisma(prisma), email: asEmail(email) }, user.email);

    expect(prisma.passwordResetToken.create).toHaveBeenCalledOnce();
    expect(email.sendPasswordReset).toHaveBeenCalledOnce();
    const arg = email.sendPasswordReset.mock.calls[0]?.[0] as { resetUrl: string };
    expect(arg.resetUrl).toContain('/reset-password?token=');
  });
});

describe('resetPassword', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('rechaza token inválido', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce(null);
    await expect(
      resetPassword({ prisma: asPrisma(prisma) }, { token: TOKEN, newPassword: 'new-secret-1234' }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rechaza token usado', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'pr1',
      userId: 'u1',
      tokenHash: sha256(TOKEN),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: new Date(),
    });
    await expect(
      resetPassword({ prisma: asPrisma(prisma) }, { token: TOKEN, newPassword: 'new-secret-1234' }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rechaza token caducado', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'pr1',
      userId: 'u1',
      tokenHash: sha256(TOKEN),
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });
    await expect(
      resetPassword({ prisma: asPrisma(prisma) }, { token: TOKEN, newPassword: 'new-secret-1234' }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('token válido marca used, hashea nueva password y revoca sesiones', async () => {
    const user = buildUser();
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'pr1',
      userId: user.id,
      tokenHash: sha256(TOKEN),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
    });

    await resetPassword(
      { prisma: asPrisma(prisma) },
      { token: TOKEN, newPassword: 'new-secret-1234' },
    );

    const userUpdate = prisma.user.update.mock.calls[0]?.[0] as {
      data: { passwordHash: string };
    };
    expect(userUpdate.data.passwordHash.startsWith('$2b$12$')).toBe(true);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: user.id, revokedAt: null },
      }),
    );
  });
});
