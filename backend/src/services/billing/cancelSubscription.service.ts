import type { Subscription } from '@prisma/client';
import { AppError, Errors } from '../../utils/errors.js';
import { recordAudit } from '../../utils/auditLog.js';
import type { BillingDeps } from './types.js';

// POST /billing/cancel — SPEC §8.4: el downgrade aplica al FIN del período
// actual, no de inmediato (el user conserva el plan pago hasta
// currentPeriodEnd). Lo que sí hacemos ya mismo es pausar el preapproval en
// MercadoPago para que no se generen más cobros — 'paused' (no 'cancelled')
// porque es reversible desde reactivateSubscription.
export async function cancelSubscription(deps: BillingDeps, userId: string): Promise<Subscription> {
  const subscription = await deps.prisma.subscription.findUnique({ where: { userId } });
  if (!subscription || subscription.status !== 'ACTIVE') {
    throw Errors.validation('No tienes una suscripción activa para cancelar.');
  }
  if (subscription.cancelAtPeriodEnd) {
    throw new AppError(
      'already_canceling',
      409,
      'Tu suscripción ya está programada para cancelarse al fin del período.',
    );
  }

  if (subscription.mpPreapprovalId) {
    await deps.mp.updatePreapprovalStatus(subscription.mpPreapprovalId, 'paused');
  }

  const updated = await deps.prisma.subscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd: true },
  });

  await recordAudit(deps.prisma, {
    userId,
    action: 'billing_cancel_requested',
    resource: 'subscription',
    resourceId: subscription.id,
  });

  return updated;
}
