import { beforeEach, describe, expect, it } from 'vitest';
import { loginUser } from '../../../src/services/auth/login.service.js';
import { hashPassword } from '../../../src/utils/password.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { createEmailMock, asEmail, type EmailMock } from '../../helpers/emailMock.js';
import { buildUser } from '../../fixtures/userFactory.js';

describe('loginUser', () => {
  let prisma: PrismaMock;
  let email: EmailMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    email = createEmailMock();
  });

  it('login exitoso devuelve tokens y resetea failedLoginAttempts', async () => {
    const passwordHash = await hashPassword('secret-1234');
    const user = buildUser({ passwordHash, failedLoginAttempts: 2 });
    prisma.user.findUnique.mockResolvedValueOnce(user);
    prisma.refreshToken.create.mockResolvedValueOnce({ id: 'rt1' });

    const result = await loginUser(
      { prisma: asPrisma(prisma), email: asEmail(email) },
      { email: user.email, password: 'secret-1234' },
    );

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toMatch(/^[0-9a-f]{96}$/); // 48 bytes hex
    expect(result.csrfToken).toMatch(/^[0-9a-f]{64}$/);
    const updateArg = prisma.user.update.mock.calls[0]?.[0] as {
      data: { failedLoginAttempts: number; accountLockedUntil: null };
    };
    expect(updateArg.data.failedLoginAttempts).toBe(0);
    expect(updateArg.data.accountLockedUntil).toBeNull();
  });

  it('email inexistente devuelve 401 genérico y logea audit', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      loginUser(
        { prisma: asPrisma(prisma), email: asEmail(email) },
        { email: 'unknown@kairo.com.co', password: 'whatever12' },
      ),
    ).rejects.toMatchObject({ statusCode: 401, code: 'unauthorized' });

    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it('password incorrecto incrementa failedLoginAttempts', async () => {
    const passwordHash = await hashPassword('correct');
    const user = buildUser({ passwordHash, failedLoginAttempts: 1 });
    prisma.user.findUnique.mockResolvedValueOnce(user);

    await expect(
      loginUser(
        { prisma: asPrisma(prisma), email: asEmail(email) },
        { email: user.email, password: 'wrong' },
      ),
    ).rejects.toMatchObject({ statusCode: 401 });

    const updateArg = prisma.user.update.mock.calls[0]?.[0] as {
      data: { failedLoginAttempts: number; accountLockedUntil: Date | null };
    };
    expect(updateArg.data.failedLoginAttempts).toBe(2);
    expect(updateArg.data.accountLockedUntil).toBeNull();
  });

  it('5º intento fallido bloquea la cuenta y envía email', async () => {
    const passwordHash = await hashPassword('correct');
    const user = buildUser({ passwordHash, failedLoginAttempts: 4 });
    prisma.user.findUnique.mockResolvedValueOnce(user);

    await expect(
      loginUser(
        { prisma: asPrisma(prisma), email: asEmail(email) },
        { email: user.email, password: 'wrong' },
      ),
    ).rejects.toMatchObject({ statusCode: 401 });

    const updateArg = prisma.user.update.mock.calls[0]?.[0] as {
      data: { failedLoginAttempts: number; accountLockedUntil: Date };
    };
    expect(updateArg.data.failedLoginAttempts).toBe(0); // reset al bloquear
    expect(updateArg.data.accountLockedUntil).toBeInstanceOf(Date);
    expect(email.sendAccountLocked).toHaveBeenCalledOnce();
  });

  it('cuenta bloqueada devuelve 403 sin verificar password', async () => {
    const user = buildUser({
      accountLockedUntil: new Date(Date.now() + 5 * 60 * 1000),
    });
    prisma.user.findUnique.mockResolvedValueOnce(user);

    await expect(
      loginUser(
        { prisma: asPrisma(prisma), email: asEmail(email) },
        { email: user.email, password: 'irrelevant' },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('email no verificado devuelve 403', async () => {
    const passwordHash = await hashPassword('secret-1234');
    const user = buildUser({ passwordHash, emailVerified: false });
    prisma.user.findUnique.mockResolvedValueOnce(user);

    await expect(
      loginUser(
        { prisma: asPrisma(prisma), email: asEmail(email) },
        { email: user.email, password: 'secret-1234' },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
