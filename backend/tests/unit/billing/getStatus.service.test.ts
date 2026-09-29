import { beforeEach, describe, expect, it } from 'vitest';
import { getBillingStatus } from '../../../src/services/billing/getStatus.service.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { buildSubscription } from '../../fixtures/subscriptionFactory.js';
import { buildPayment } from '../../fixtures/paymentFactory.js';

describe('getBillingStatus', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('devuelve la suscripción y los últimos pagos del user', async () => {
    const sub = buildSubscription();
    const payments = [buildPayment({ userId: sub.userId })];
    prisma.subscription.findUnique.mockResolvedValue(sub);
    prisma.payment.findMany.mockResolvedValue(payments);

    const result = await getBillingStatus({ prisma: asPrisma(prisma) }, sub.userId);

    expect(result).toEqual({ subscription: sub, payments });
    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: { userId: sub.userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  });

  it('devuelve subscription null si el user nunca se suscribió', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);
    prisma.payment.findMany.mockResolvedValue([]);

    const result = await getBillingStatus({ prisma: asPrisma(prisma) }, 'user-1');
    expect(result.subscription).toBeNull();
    expect(result.payments).toEqual([]);
  });
});
