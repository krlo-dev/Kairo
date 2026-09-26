// Factory de TrackedProduct para tests — objeto completo estilo fila de DB.

import { randomBytes, randomUUID } from 'node:crypto';
import type { Currency, Source, TrackedProduct } from '@prisma/client';

interface TrackedProductInput {
  id?: string;
  userId?: string;
  externalId?: string;
  source?: Source;
  title?: string;
  imageUrl?: string | null;
  productUrl?: string;
  currentPrice?: number;
  currency?: Currency;
  country?: string;
  addedAt?: Date;
  lockedUntil?: Date | null;
  isActive?: boolean;
}

export function buildTrackedProduct(overrides: TrackedProductInput = {}): TrackedProduct {
  const suffix = randomBytes(4).toString('hex');
  const now = new Date();
  return {
    id: overrides.id ?? randomUUID(),
    userId: overrides.userId ?? randomUUID(),
    externalId: overrides.externalId ?? `MLA-${suffix}`,
    source: overrides.source ?? ('ML' satisfies Source),
    title: overrides.title ?? `Producto ${suffix}`,
    imageUrl: overrides.imageUrl ?? `https://example.com/${suffix}.jpg`,
    productUrl: overrides.productUrl ?? `https://example.com/p/${suffix}`,
    // Prisma.Decimal en runtime real, pero para el mock un number basta
    // (los services no llaman métodos de Decimal sobre currentPrice).
    currentPrice: (overrides.currentPrice ?? 99900) as unknown as TrackedProduct['currentPrice'],
    currency: overrides.currency ?? ('COP' satisfies Currency),
    country: overrides.country ?? 'CO',
    addedAt: overrides.addedAt ?? now,
    lockedUntil: overrides.lockedUntil === undefined ? null : overrides.lockedUntil,
    isActive: overrides.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  };
}
