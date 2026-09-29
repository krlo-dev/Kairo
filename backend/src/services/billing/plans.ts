import type { Plan } from '@prisma/client';
import { PLAN_LIMITS } from '../../utils/planLimits.js';

// Precios mensuales en COP, IVA 19% Colombia incluido (SPEC §8.4).
// FREE no tiene precio — no aparece en PRICING_COP.
const LABELS: Record<Plan, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  COMERCIANTE: 'Comerciante',
};

const PRICING_COP: Partial<Record<Plan, number>> = {
  PRO: 29900,
  COMERCIANTE: 79900,
};

export interface PlanInfo {
  plan: Plan;
  label: string;
  amountCOP: number | null; // null = plan gratuito
  maxTrackedProducts: number | null; // null = ilimitado
  sources: readonly string[];
  alertChannels: readonly string[];
  canSeeTrending: boolean;
  canExportCSV: boolean;
  canSeeMargins: boolean;
}

export function getPlans(): PlanInfo[] {
  return (Object.keys(PLAN_LIMITS) as Plan[]).map((plan) => {
    const limits = PLAN_LIMITS[plan];
    return {
      plan,
      label: LABELS[plan],
      amountCOP: PRICING_COP[plan] ?? null,
      maxTrackedProducts: Number.isFinite(limits.maxTrackedProducts)
        ? limits.maxTrackedProducts
        : null,
      sources: limits.sources,
      alertChannels: limits.alertChannels,
      canSeeTrending: limits.canSeeTrending,
      canExportCSV: limits.canExportCSV,
      canSeeMargins: limits.canSeeMargins,
    };
  });
}

export type PaidPlan = 'PRO' | 'COMERCIANTE';

export function getPlanPricing(plan: PaidPlan): { label: string; amountCOP: number } {
  const amountCOP = PRICING_COP[plan];
  if (amountCOP === undefined) {
    throw new Error(`No hay precio configurado para el plan ${plan}`);
  }
  return { label: LABELS[plan], amountCOP };
}
