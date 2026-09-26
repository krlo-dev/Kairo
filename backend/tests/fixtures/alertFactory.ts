// Factory de Alert para tests.

import { randomUUID } from 'node:crypto';
import type { Alert, AlertDirection, AlertMode } from '@prisma/client';

interface AlertInput {
  id?: string;
  userId?: string;
  trackedProductId?: string;
  mode?: AlertMode;
  direction?: AlertDirection;
  targetPrice?: number | null;
  pctThreshold?: number | null;
  basePrice?: number | null;
  cooldownDays?: number;
  notifyEmail?: boolean;
  notifyWhatsapp?: boolean;
  isActive?: boolean;
  triggered?: boolean;
  lastTriggeredAt?: Date | null;
}

export function buildAlert(overrides: AlertInput = {}): Alert {
  const now = new Date();
  return {
    id: overrides.id ?? randomUUID(),
    userId: overrides.userId ?? randomUUID(),
    trackedProductId: overrides.trackedProductId ?? randomUUID(),
    mode: overrides.mode ?? ('ONE_SHOT' satisfies AlertMode),
    direction: overrides.direction ?? ('DOWN' satisfies AlertDirection),
    targetPrice: (overrides.targetPrice === undefined
      ? 90000
      : overrides.targetPrice) as unknown as Alert['targetPrice'],
    pctThreshold: overrides.pctThreshold === undefined ? null : overrides.pctThreshold,
    basePrice: (overrides.basePrice === undefined
      ? 100000
      : overrides.basePrice) as unknown as Alert['basePrice'],
    cooldownDays: overrides.cooldownDays ?? 7,
    notifyEmail: overrides.notifyEmail ?? true,
    notifyWhatsapp: overrides.notifyWhatsapp ?? false,
    isActive: overrides.isActive ?? true,
    triggered: overrides.triggered ?? false,
    lastTriggeredAt: overrides.lastTriggeredAt === undefined ? null : overrides.lastTriggeredAt,
    createdAt: now,
    updatedAt: now,
  };
}
