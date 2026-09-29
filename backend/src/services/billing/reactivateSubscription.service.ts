import type { Subscription } from '@prisma/client';
import { Errors } from '../../utils/errors.js';
import { recordAudit } from '../../utils/auditLog.js';
import type { BillingDeps } from './types.js';

// POST /billing/reactivate — revierte una cancelación programada (todavía
// dentro del período pagado): reanuda el preapproval en MercadoPago y quita
// el flag cancelAtPeriodEnd. Si el período ya venció, la Subscription ya fue
// downgradeada por el job nocturno y esto ya no aplica (hay que hacer un
// checkout nuevo).
export async function reactivateSubscription(
  deps: BillingDeps,
  userId: string,
): Promise<Subscription> {
  const subscription = await deps.prisma.subscription.findUnique({ where: { userId } });
  if (!subscription || subscription.status !== 'ACTIVE' || !subscription.cancelAtPeriodEnd) {
    throw Errors.validation('No hay una cancelación pendiente para revertir.');
  }

  if (subscription.mpPreapprovalId) {
    await deps.mp.updatePreapprovalStatus(subscription.mpPreapprovalId, 'authorized');
  }

  const updated = await deps.prisma.subscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd: false },
  });

  await recordAudit(deps.prisma, {
    userId,
    action: 'billing_reactivated',
    resource: 'subscription',
    resourceId: subscription.id,
  });

  return updated;
}
