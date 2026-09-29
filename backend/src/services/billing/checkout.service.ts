import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { recordAudit } from '../../utils/auditLog.js';
import { getPlanPricing, type PaidPlan } from './plans.js';
import type { BillingDeps } from './types.js';

export interface CheckoutResult {
  initPoint: string;
}

// POST /billing/checkout — SPEC §8.4 paso 1-2. Crea (o reutiliza) la
// Subscription 1:1 del user en estado INCOMPLETE y arranca un preapproval en
// MercadoPago; el webhook confirma el pago y activa la suscripción.
export async function checkout(
  deps: BillingDeps,
  userId: string,
  targetPlan: PaidPlan,
): Promise<CheckoutResult> {
  const user = await deps.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const pricing = getPlanPricing(targetPlan);

  const existing = await deps.prisma.subscription.findUnique({ where: { userId } });
  if (existing && existing.status === 'ACTIVE' && existing.plan === targetPlan) {
    throw new AppError('already_subscribed', 409, `Ya tienes el plan ${targetPlan} activo.`);
  }

  const subscription = existing
    ? await deps.prisma.subscription.update({
        where: { userId },
        data: {
          plan: targetPlan,
          status: 'INCOMPLETE',
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      })
    : await deps.prisma.subscription.create({
        data: { userId, plan: targetPlan, status: 'INCOMPLETE' },
      });

  const preapproval = await deps.mp.createPreapproval({
    email: user.email,
    planLabel: pricing.label,
    amountCOP: pricing.amountCOP,
    externalReference: subscription.id,
    backUrl: `${env.FRONTEND_URL}/settings?billing=success`,
  });

  await deps.prisma.subscription.update({
    where: { userId },
    data: { mpPreapprovalId: preapproval.id },
  });

  await recordAudit(deps.prisma, {
    userId,
    action: 'billing_checkout_started',
    resource: 'subscription',
    resourceId: subscription.id,
    metadata: { plan: targetPlan },
  });

  return { initPoint: preapproval.initPoint };
}
