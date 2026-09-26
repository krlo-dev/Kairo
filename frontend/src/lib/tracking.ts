import { api } from './api';
import type { UnifiedProduct } from './search';

export interface TrackedProduct {
  id: string;
  userId: string;
  externalId: string;
  source: 'ML' | 'ALIEXPRESS';
  title: string;
  imageUrl: string | null;
  productUrl: string;
  // Prisma.Decimal serializa a string en JSON — se convierte a number donde se usa.
  currentPrice: string;
  currency: 'COP' | 'USD' | 'MXN' | 'ARS' | 'CLP' | 'BRL' | 'PEN';
  country: string;
  addedAt: string;
  lockedUntil: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrackedProductListResult {
  data: TrackedProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function listTrackedProducts(page = 1, limit = 20): Promise<TrackedProductListResult> {
  const res = await api.get<TrackedProductListResult>('/tracking', {
    params: { page, limit },
  });
  return res.data;
}

export async function addTrackedProduct(product: UnifiedProduct): Promise<TrackedProduct> {
  const res = await api.post<{ data: TrackedProduct }>('/tracking', {
    externalId: product.externalId,
    source: product.source,
    title: product.title,
    imageUrl: product.imageUrl,
    productUrl: product.productUrl,
    currentPrice: product.price,
    currency: product.currency,
    country: product.country,
  });
  return res.data.data;
}

export async function removeTrackedProduct(id: string): Promise<void> {
  await api.delete(`/tracking/${id}`);
}
