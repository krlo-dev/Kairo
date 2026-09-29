import { beforeEach, describe, expect, it } from 'vitest';
import { cancelSubscription } from '../../../src/services/billing/cancelSubscription.service.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { createMpMock, asMp, type MpMock } from '../../helpers/mpMock.js';
import { buildSubscription } from '../../fixtures/subscriptionFactory.js';

describe('cancelSubscription', () => {
  let prisma: PrismaMock;
  let mp: MpMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    mp = createMpMock();
  });

  it('pausa el preapproval en MP y marca cancelAtPeriodEnd', async () => {
    const sub = buildSubscription({
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
      mpPreapprovalId: 'pre-1',
    });
    prisma.subscription.findUnique.mockResolvedValue(sub);
    prisma.subscription.update.mockResolvedValue({ ...sub, cancelAtPeriodEnd: true });

    const result = await cancelSubscription({ prisma: asPrisma(prisma), mp: asMp(mp) }, sub.userId);

    expect(mp.updatePreapprovalStatus).toHaveBeenCalledWith('pre-1', 'paused');
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { userId: sub.userId },
      data: { cancelAtPeriodEnd: true },
    });
    expect(result.cancelAtPeriodEnd).toBe(true);
  });

  it('rechaza si no hay suscripción activa', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);
    await expect(
      cancelSubscription({ prisma: asPrisma(prisma), mp: asMp(mp) }, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rechaza si ya está programada la cancelación', async () => {
    const sub = buildSubscription({ status: 'ACTIVE', cancelAtPeriodEnd: true });
    prisma.subscription.findUnique.mockResolvedValue(sub);
    await expect(
      cancelSubscription({ prisma: asPrisma(prisma), mp: asMp(mp) }, sub.userId),
    ).rejects.toMatchObject({ code: 'already_canceling' });
  });
});
