import type { Plan } from '@prisma/client';

export const PLAN_LIMITS = {
  FREE: {
    maxTrackedProducts: 3,
    sources: ['ML'] as const,
    countries: ['CO'] as const,
    alertChannels: ['email'] as const,
    canSeeTrending: false,
    trendingByCategory: false,
    trendingAllLatam: false,
    canExportCSV: false,
    canSeeMargins: false,
    hasAds: true,
    productLockDays: 30,
  },
  PRO: {
    maxTrackedProducts: 50,
    sources: ['ML', 'ALIEXPRESS'] as const,
    countries: ['CO', 'MX', 'AR', 'CL', 'BR', 'PE'] as const,
    alertChannels: ['email', 'whatsapp'] as const,
    canSeeTrending: true,
    trendingByCategory: true,
    trendingAllLatam: false,
    canExportCSV: false,
    canSeeMargins: false,
    hasAds: false,
    productLockDays: 0,
  },
  COMERCIANTE: {
    maxTrackedProducts: Number.POSITIVE_INFINITY,
    sources: ['ML', 'ALIEXPRESS'] as const,
    countries: ['CO', 'MX', 'AR', 'CL', 'BR', 'PE', 'ALL'] as const,
    alertChannels: ['email', 'whatsapp'] as const,
    canSeeTrending: true,
    trendingByCategory: true,
    trendingAllLatam: true,
    canExportCSV: true,
    canSeeMargins: true,
    hasAds: false,
    productLockDays: 0,
  },
} as const satisfies Record<Plan, unknown>;

export type PlanLimits = (typeof PLAN_LIMITS)[Plan];

export function getLimitsFor(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}
