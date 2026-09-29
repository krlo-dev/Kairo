import { beforeEach, describe, expect, it } from 'vitest';
import { checkout } from '../../../src/services/billing/checkout.service.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { createMpMock, asMp, type MpMock } from '../../helpers/mpMock.js';
import { buildUser } from '../../fixtures/userFactory.js';
import { buildSubscription } from '../../fixtures/subscriptionFactory.js';

describe('checkout', () => {
  let prisma: PrismaMock;
  let mp: MpMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    mp = createMpMock();
  });

  it('crea una Subscription nueva y devuelve el initPoint de MP', async () => {
    const user = buildUser({ plan: 'FREE' });
    prisma.user.findUniqueOrThrow.mockResolvedValue(user);
    prisma.subscription.findUnique.mockResolvedValue(null);
    const created = buildSubscription({ userId: user.id, plan: 'PRO', status: 'INCOMPLETE' });
    prisma.subscription.create.mockResolvedValue(created);
    prisma.subscription.update.mockResolvedValue({ ...created, mpPreapprovalId: 'preapproval-1' });
    mp.createPreapproval.mockResolvedValue({
      id: 'preapproval-1',
      initPoint: 'https://mp/checkout/1',
    });

    const result = await checkout({ prisma: asPrisma(prisma), mp: asMp(mp) }, user.id, 'PRO');

    expect(result).toEqual({ initPoint: 'https://mp/checkout/1' });
    expect(prisma.subscription.create).toHaveBeenCalledWith({
      data: { userId: user.id, plan: 'PRO', status: 'INCOMPLETE' },
    });
    expect(mp.createPreapproval).toHaveBeenCalledWith(
      expect.objectContaining({
        email: user.email,
        amountCOP: 29900,
        externalReference: created.id,
      }),
    );
  });

  it('reutiliza la Subscription existente si no está activa con ese plan', async () => {
    const user = buildUser({ plan: 'FREE' });
    prisma.user.findUniqueOrThrow.mockResolvedValue(user);
    const existing = buildSubscription({ userId: user.id, plan: 'PRO', status: 'CANCELED' });
    prisma.subscription.findUnique.mockResolvedValue(existing);
    prisma.subscription.update.mockResolvedValue({ ...existing, status: 'INCOMPLETE' });
    mp.createPreapproval.mockResolvedValue({
      id: 'preapproval-2',
      initPoint: 'https://mp/checkout/2',
    });

    const result = await checkout({ prisma: asPrisma(prisma), mp: asMp(mp) }, user.id, 'PRO');

    expect(result).toEqual({ initPoint: 'https://mp/checkout/2' });
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('rechaza si el user ya tiene ese plan ACTIVE', async () => {
    const user = buildUser({ plan: 'PRO' });
    prisma.user.findUniqueOrThrow.mockResolvedValue(user);
    prisma.subscription.findUnique.mockResolvedValue(
      buildSubscription({ userId: user.id, plan: 'PRO', status: 'ACTIVE' }),
    );

    await expect(
      checkout({ prisma: asPrisma(prisma), mp: asMp(mp) }, user.id, 'PRO'),
    ).rejects.toMatchObject({ code: 'already_subscribed' });
    expect(mp.createPreapproval).not.toHaveBeenCalled();
  });
});
