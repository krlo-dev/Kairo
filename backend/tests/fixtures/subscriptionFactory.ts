// Factory de Subscription para tests — objeto completo estilo fila de DB.

import { randomUUID } from 'node:crypto';
import type { Plan, Subscription, SubscriptionStatus } from '@prisma/client';

interface SubscriptionInput {
  id?: string;
  userId?: string;
  plan?: Plan;
  status?: SubscriptionStatus;
  mpPreapprovalId?: string | null;
  mpPayerId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
}

export function buildSubscription(overrides: SubscriptionInput = {}): Subscription {
  const now = new Date();
  return {
    id: overrides.id ?? randomUUID(),
    userId: overrides.userId ?? randomUUID(),
    plan: overrides.plan ?? ('PRO' satisfies Plan),
    status: overrides.status ?? ('ACTIVE' satisfies SubscriptionStatus),
    mpPreapprovalId:
      overrides.mpPreapprovalId === undefined
        ? `mp-preapproval-${randomUUID()}`
        : overrides.mpPreapprovalId,
    mpPayerId: overrides.mpPayerId ?? null,
    currentPeriodStart:
      overrides.currentPeriodStart === undefined ? now : overrides.currentPeriodStart,
    currentPeriodEnd:
      overrides.currentPeriodEnd === undefined
        ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        : overrides.currentPeriodEnd,
    cancelAtPeriodEnd: overrides.cancelAtPeriodEnd ?? false,
    canceledAt: overrides.canceledAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
}
