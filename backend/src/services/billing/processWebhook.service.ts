import { logger } from '../../logger/pino.js';
import { recordAudit } from '../../utils/auditLog.js';
import { downgradeUserToFree } from './downgradeUserToFree.js';
import type { BillingWebhookDeps } from './types.js';

export interface WebhookInput {
  type: string; // 'payment' | 'subscription_preapproval' | otros (se ignoran)
  dataId: string;
}

const HANDLED_TYPES = new Set(['payment', 'subscription_preapproval']);

// Procesa una notificación de webhook de MercadoPago (SPEC §8.4). MP solo
// manda `{type, data: {id}}` — hay que ir a buscar el recurso real con la
// API antes de actuar. Idempotente vía WebhookEvent(provider, externalId):
// si ya se procesó, no se repite el efecto (evita doble-activación si MP
// reintenta la entrega).
export async function processMpWebhook(
  deps: BillingWebhookDeps,
  input: WebhookInput,
): Promise<void> {
  if (!HANDLED_TYPES.has(input.type)) {
    logger.info({ type: input.type }, 'mp webhook: tipo no manejado, ignorado');
    return;
  }

  const externalId = `${input.type}:${input.dataId}`;
  const existing = await deps.prisma.webhookEvent.findUnique({
    where: { provider_externalId: { provider: 'mercadopago', externalId } },
  });
  if (existing?.processedAt) {
    return;
  }

  const event =
    existing ??
    (await deps.prisma.webhookEvent.create({
      data: {
        provider: 'mercadopago',
        externalId,
        payload: { type: input.type, dataId: input.dataId } satisfies Record<string, unknown>,
      },
    }));

  try {
    if (input.type === 'payment') {
      await handlePaymentEvent(deps, input.dataId);
    } else {
      await handlePreapprovalEvent(deps, input.dataId);
    }
    await deps.prisma.webhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });
  } catch (err) {
    await deps.prisma.webhookEvent.update({
      where: { id: event.id },
      data: { errorMessage: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}

async function handlePaymentEvent(deps: BillingWebhookDeps, paymentId: string): Promise<void> {
  const payment = await deps.mp.getPayment(paymentId);
  if (!payment.externalReference) {
    logger.warn({ paymentId }, 'mp payment webhook sin external_reference, ignorado');
    return;
  }

  const subscription = await deps.prisma.subscription.findUnique({
    where: { id: payment.externalReference },
  });
  if (!subscription) {
    logger.warn(
      { paymentId, externalReference: payment.externalReference },
      'mp payment webhook: subscription no encontrada',
    );
    return;
  }

  const status = mapPaymentStatus(payment.status);

  await deps.prisma.payment.upsert({
    where: { mpPaymentId: payment.id },
    create: {
      userId: subscription.userId,
      mpPaymentId: payment.id,
      amount: payment.transactionAmount,
      currency: 'COP',
      status,
      method: payment.paymentMethodId,
      paidAt: status === 'APPROVED' ? new Date() : null,
      failureReason: status === 'REJECTED' ? payment.statusDetail : null,
    },
    update: {
      status,
      paidAt: status === 'APPROVED' ? new Date() : null,
      failureReason: status === 'REJECTED' ? payment.statusDetail : null,
    },
  });

  if (status === 'APPROVED') {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await deps.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: periodEnd },
    });
    await deps.prisma.user.update({
      where: { id: subscription.userId },
      data: { plan: subscription.plan },
    });
    await recordAudit(deps.prisma, {
      userId: subscription.userId,
      action: 'payment_approved',
      resource: 'subscription',
      resourceId: subscription.id,
    });
  } else if (status === 'REJECTED' && subscription.status === 'ACTIVE') {
    // Falló un cobro de renovación sobre una suscripción que ya estaba
    // activa — periodo de gracia (SPEC state machine: ACTIVE → PAST_DUE).
    await deps.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'PAST_DUE' },
    });
    await recordAudit(deps.prisma, {
      userId: subscription.userId,
      action: 'payment_rejected',
      resource: 'subscription',
      resourceId: subscription.id,
    });
  }
}

async function handlePreapprovalEvent(
  deps: BillingWebhookDeps,
  preapprovalId: string,
): Promise<void> {
  const preapproval = await deps.mp.getPreapproval(preapprovalId);
  const subscription = await deps.prisma.subscription.findUnique({
    where: { mpPreapprovalId: preapproval.id },
  });
  if (!subscription) {
    logger.warn({ preapprovalId }, 'mp preapproval webhook: subscription no encontrada');
    return;
  }

  // Solo actuamos sobre cancelación (el resto de transiciones de estado de
  // MP para preapproval las maneja implícitamente el flujo de payment).
  if (preapproval.status === 'cancelled' && subscription.status !== 'CANCELED') {
    const user = await deps.prisma.user.findUnique({ where: { id: subscription.userId } });
    await deps.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELED', canceledAt: new Date(), cancelAtPeriodEnd: false },
      });
      await downgradeUserToFree(tx, subscription.userId);
    });

    await recordAudit(deps.prisma, {
      userId: subscription.userId,
      action: 'subscription_canceled_by_mp',
      resource: 'subscription',
      resourceId: subscription.id,
    });

    if (user) {
      await deps.email
        .sendPlanDowngraded({ to: user.email, name: user.name, fromPlan: subscription.plan })
        .catch((err: unknown) => logger.error({ err }, 'sendPlanDowngraded failed'));
    }
  }
}

function mapPaymentStatus(
  mpStatus: string,
): 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED' | 'CHARGED_BACK' {
  switch (mpStatus) {
    case 'approved':
      return 'APPROVED';
    case 'rejected':
    case 'cancelled':
      return 'REJECTED';
    case 'refunded':
      return 'REFUNDED';
    case 'charged_back':
      return 'CHARGED_BACK';
    default:
      return 'PENDING';
  }
}
