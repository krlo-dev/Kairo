import { beforeEach, describe, expect, it } from 'vitest';
import { reactivateSubscription } from '../../../src/services/billing/reactivateSubscription.service.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { createMpMock, asMp, type MpMock } from '../../helpers/mpMock.js';
import { buildSubscription } from '../../fixtures/subscriptionFactory.js';

describe('reactivateSubscription', () => {
  let prisma: PrismaMock;
  let mp: MpMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    mp = createMpMock();
  });

  it('reanuda el preapproval en MP y quita cancelAtPeriodEnd', async () => {
    const sub = buildSubscription({
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
      mpPreapprovalId: 'pre-1',
    });
    prisma.subscription.findUnique.mockResolvedValue(sub);
    prisma.subscription.update.mockResolvedValue({ ...sub, cancelAtPeriodEnd: false });

    const result = await reactivateSubscription(
      { prisma: asPrisma(prisma), mp: asMp(mp) },
      sub.userId,
    );

    expect(mp.updatePreapprovalStatus).toHaveBeenCalledWith('pre-1', 'authorized');
    expect(result.cancelAtPeriodEnd).toBe(false);
  });

  it('rechaza si no hay cancelación pendiente', async () => {
    const sub = buildSubscription({ status: 'ACTIVE', cancelAtPeriodEnd: false });
    prisma.subscription.findUnique.mockResolvedValue(sub);
    await expect(
      reactivateSubscription({ prisma: asPrisma(prisma), mp: asMp(mp) }, sub.userId),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
