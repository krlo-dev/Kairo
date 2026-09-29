// Factory de Payment para tests — objeto completo estilo fila de DB.

import { randomBytes, randomUUID } from 'node:crypto';
import type { Currency, Payment, PaymentStatus } from '@prisma/client';

interface PaymentInput {
  id?: string;
  userId?: string;
  mpPaymentId?: string;
  amount?: number;
  currency?: Currency;
  status?: PaymentStatus;
  method?: string | null;
  paidAt?: Date | null;
  failureReason?: string | null;
}

export function buildPayment(overrides: PaymentInput = {}): Payment {
  const suffix = randomBytes(4).toString('hex');
  const now = new Date();
  return {
    id: overrides.id ?? randomUUID(),
    userId: overrides.userId ?? randomUUID(),
    mpPaymentId: overrides.mpPaymentId ?? `mp-payment-${suffix}`,
    amount: (overrides.amount ?? 29900) as unknown as Payment['amount'],
    currency: overrides.currency ?? ('COP' satisfies Currency),
    status: overrides.status ?? ('APPROVED' satisfies PaymentStatus),
    method: overrides.method ?? 'credit_card',
    paidAt: overrides.paidAt === undefined ? now : overrides.paidAt,
    failureReason: overrides.failureReason ?? null,
    createdAt: now,
  };
}
