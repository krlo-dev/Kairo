import { beforeEach, describe, expect, it } from 'vitest';
import { downgradeExpiredSubscriptionsOnce } from '../../../src/jobs/subscriptionDowngrade.job.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { createEmailMock, asEmail, type EmailMock } from '../../helpers/emailMock.js';
import { buildSubscription } from '../../fixtures/subscriptionFactory.js';
import { buildUser } from '../../fixtures/userFactory.js';

describe('downgradeExpiredSubscriptionsOnce', () => {
  let prisma: PrismaMock;
  let email: EmailMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    email = createEmailMock();
  });

  it('sin suscripciones vencidas no hace nada', async () => {
    prisma.subscription.findMany.mockResolvedValue([]);
    const summary = await downgradeExpiredSubscriptionsOnce({
      prisma: asPrisma(prisma),
      email: asEmail(email),
    });
    expect(summary).toEqual({ due: 0, downgraded: 0, failed: 0 });
    expect(email.sendPlanDowngraded).not.toHaveBeenCalled();
  });

  it('downgradea cada suscripción vencida y manda el email', async () => {
    const user = buildUser({ plan: 'PRO' });
    const sub = buildSubscription({
      userId: user.id,
      plan: 'PRO',
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
    });
    prisma.subscription.findMany.mockResolvedValue([{ ...sub, user }]);
    prisma.subscription.update.mockResolvedValue({ ...sub, status: 'CANCELED' });
    prisma.user.update.mockResolvedValue({});
    prisma.trackedProduct.findMany.mockResolvedValue([]);

    const summary = await downgradeExpiredSubscriptionsOnce({
      prisma: asPrisma(prisma),
      email: asEmail(email),
    });

    expect(summary).toEqual({ due: 1, downgraded: 1, failed: 0 });
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sub.id },
        data: expect.objectContaining({ status: 'CANCELED' }) as unknown,
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { plan: 'FREE' },
    });
    expect(email.sendPlanDowngraded).toHaveBeenCalledWith(
      expect.objectContaining({ to: user.email, fromPlan: 'PRO' }),
    );
  });

  it('un error en una suscripción no detiene el resto del batch', async () => {
    const userA = buildUser({ plan: 'PRO' });
    const subA = buildSubscription({
      userId: userA.id,
      plan: 'PRO',
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
    });
    const userB = buildUser({ plan: 'COMERCIANTE' });
    const subB = buildSubscription({
      userId: userB.id,
      plan: 'COMERCIANTE',
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
    });
    prisma.subscription.findMany.mockResolvedValue([
      { ...subA, user: userA },
      { ...subB, user: userB },
    ]);
    prisma.subscription.update.mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce({
      ...subB,
      status: 'CANCELED',
    });
    prisma.user.update.mockResolvedValue({});
    prisma.trackedProduct.findMany.mockResolvedValue([]);

    const summary = await downgradeExpiredSubscriptionsOnce({
      prisma: asPrisma(prisma),
      email: asEmail(email),
    });

    expect(summary).toEqual({ due: 2, downgraded: 1, failed: 1 });
  });
});
