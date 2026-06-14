import { beforeEach, describe, expect, it } from 'vitest';
import { registerUser } from '../../../src/services/auth/register.service.js';
import { AppError } from '../../../src/utils/errors.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { createEmailMock, asEmail, type EmailMock } from '../../helpers/emailMock.js';
import { buildUser } from '../../fixtures/userFactory.js';

describe('registerUser', () => {
  let prisma: PrismaMock;
  let email: EmailMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    email = createEmailMock();
  });

  it('crea el user, encola el EmailVerification y envía el email', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const createdUser = buildUser({
      email: 'nuevo@kairo.com.co',
      name: 'Nuevo Dev',
      emailVerified: false,
    });
    prisma.user.create.mockResolvedValueOnce(createdUser);
    prisma.emailVerification.create.mockResolvedValueOnce({ id: 'ev1' });

    const result = await registerUser(
      { prisma: asPrisma(prisma), email: asEmail(email) },
      { email: 'Nuevo@kairo.com.co  ', password: 'secret-1234', name: 'Nuevo Dev' },
      { ip: '127.0.0.1', userAgent: 'vitest' },
    );

    expect(result.email).toBe('nuevo@kairo.com.co'); // normalizado a lowercase
    expect(result.emailVerified).toBe(false);
    expect(prisma.user.create).toHaveBeenCalledOnce();
    const createArg = prisma.user.create.mock.calls[0]?.[0] as { data: { email: string } };
    expect(createArg.data.email).toBe('nuevo@kairo.com.co');
    expect(email.sendVerifyEmail).toHaveBeenCalledOnce();
    const verifyArg = email.sendVerifyEmail.mock.calls[0]?.[0] as { verifyUrl: string };
    expect(verifyArg.verifyUrl).toContain('/verify-email?token=');
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it('rechaza email ya existente con mensaje neutro 409', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(buildUser());

    await expect(
      registerUser(
        { prisma: asPrisma(prisma), email: asEmail(email) },
        { email: 'existing@kairo.com.co', password: 'secret-1234', name: 'X' },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'conflict',
    });

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(email.sendVerifyEmail).not.toHaveBeenCalled();
  });

  it('lanza AppError', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(buildUser());
    await expect(
      registerUser(
        { prisma: asPrisma(prisma), email: asEmail(email) },
        { email: 'x@kairo.com.co', password: 'secret-1234', name: 'X' },
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});
