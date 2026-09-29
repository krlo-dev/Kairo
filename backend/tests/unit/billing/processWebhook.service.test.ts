import { beforeEach, describe, expect, it } from 'vitest';
import { processMpWebhook } from '../../../src/services/billing/processWebhook.service.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { createMpMock, asMp, type MpMock } from '../../helpers/mpMock.js';
import { createEmailMock, asEmail, type EmailMock } from '../../helpers/emailMock.js';
import { buildSubscription } from '../../fixtures/subscriptionFactory.js';
import { buildUser } from '../../fixtures/userFactory.js';

describe('processMpWebhook', () => {
  let prisma: PrismaMock;
  let mp: MpMock;
  let email: EmailMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    mp = createMpMock();
    email = createEmailMock();
    prisma.webhookEvent.findUnique.mockResolvedValue(null);
    prisma.webhookEvent.create.mockResolvedValue({ id: 'evt-1' });
    prisma.webhookEvent.update.mockResolvedValue({});
  });

  it('ignora tipos de evento no manejados', async () => {
    await processMpWebhook(
      { prisma: asPrisma(prisma), mp: asMp(mp), email: asEmail(email) },
      { type: 'point_integration_wh', dataId: '1' },
    );
    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
    expect(mp.getPayment).not.toHaveBeenCalled();
  });

  it('es idempotente: no reprocesa un evento ya marcado processedAt', async () => {
    prisma.webhookEvent.findUnique.mockResolvedValue({ id: 'evt-1', processedAt: new Date() });
    await processMpWebhook(
      { prisma: asPrisma(prisma), mp: asMp(mp), email: asEmail(email) },
      { type: 'payment', dataId: '999' },
    );
    expect(mp.getPayment).not.toHaveBeenCalled();
  });

  it('payment aprobado activa la Subscription y actualiza el plan del user', async () => {
    const sub = buildSubscription({ status: 'INCOMPLETE', plan: 'PRO' });
    mp.getPayment.mockResolvedValue({
      id: '999',
      status: 'approved',
      statusDetail: null,
      transactionAmount: 29900,
      currencyId: 'COP',
      externalReference: sub.id,
      paymentMethodId: 'visa',
    });
    prisma.subscription.findUnique.mockResolvedValue(sub);
    prisma.payment.upsert.mockResolvedValue({});
    prisma.subscription.update.mockResolvedValue({ ...sub, status: 'ACTIVE' });
    prisma.user.update.mockResolvedValue({});

    await processMpWebhook(
      { prisma: asPrisma(prisma), mp: asMp(mp), email: asEmail(email) },
      { type: 'payment', dataId: '999' },
    );

    expect(prisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { mpPaymentId: '999' } }),
    );
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sub.id },
        data: expect.objectContaining({ status: 'ACTIVE' }) as unknown,
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: sub.userId },
      data: { plan: 'PRO' },
    });
    expect(prisma.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processedAt: expect.any(Date) as unknown }) as unknown,
      }),
    );
  });

  it('payment rechazado sobre una Subscription ACTIVE la pasa a PAST_DUE', async () => {
    const sub = buildSubscription({ status: 'ACTIVE', plan: 'PRO' });
    mp.getPayment.mockResolvedValue({
      id: '1000',
      status: 'rejected',
      statusDetail: 'cc_rejected_insufficient_amount',
      transactionAmount: 29900,
      currencyId: 'COP',
      externalReference: sub.id,
      paymentMethodId: 'visa',
    });
    prisma.subscription.findUnique.mockResolvedValue(sub);
    prisma.payment.upsert.mockResolvedValue({});
    prisma.subscription.update.mockResolvedValue({ ...sub, status: 'PAST_DUE' });

    await processMpWebhook(
      { prisma: asPrisma(prisma), mp: asMp(mp), email: asEmail(email) },
      { type: 'payment', dataId: '1000' },
    );

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: sub.id },
      data: { status: 'PAST_DUE' },
    });
  });

  it('preapproval cancelado desde MP downgradea al user a FREE y notifica', async () => {
    const sub = buildSubscription({ status: 'ACTIVE', plan: 'PRO', mpPreapprovalId: 'pre-1' });
    const user = buildUser({ id: sub.userId, plan: 'PRO' });
    mp.getPreapproval.mockResolvedValue({
      id: 'pre-1',
      status: 'cancelled',
      externalReference: sub.id,
    });
    prisma.subscription.findUnique.mockResolvedValue(sub);
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.subscription.update.mockResolvedValue({ ...sub, status: 'CANCELED' });
    prisma.user.update.mockResolvedValue({});
    prisma.trackedProduct.findMany.mockResolvedValue([]);

    await processMpWebhook(
      { prisma: asPrisma(prisma), mp: asMp(mp), email: asEmail(email) },
      { type: 'subscription_preapproval', dataId: 'pre-1' },
    );

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sub.id },
        data: expect.objectContaining({ status: 'CANCELED' }) as unknown,
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: sub.userId },
      data: { plan: 'FREE' },
    });
    expect(email.sendPlanDowngraded).toHaveBeenCalledWith(
      expect.objectContaining({ to: user.email, fromPlan: 'PRO' }),
    );
  });
});
