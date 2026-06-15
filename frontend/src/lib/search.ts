import { api } from './api';

export interface UnifiedProduct {
  externalId: string;
  source: 'ML' | 'ALIEXPRESS';
  title: string;
  imageUrl: string | null;
  productUrl: string;
  price: number;
  currency: 'COP' | 'MXN' | 'ARS' | 'CLP' | 'BRL' | 'PEN' | 'USD';
  country: string;
  sellerNickname?: string;
  shipping?: { free: boolean };
  condition?: 'new' | 'used' | 'unspecified';
}

export interface SearchResult {
  data: UnifiedProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SearchParams {
  q: string;
  country?: string;
  source?: 'ML' | 'ALIEXPRESS' | 'both';
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

export async function searchProducts(params: SearchParams): Promise<SearchResult> {
  const qs: Record<string, string> = { q: params.q };
  if (params.country) qs.country = params.country;
  if (params.source) qs.source = params.source;
  if (params.minPrice !== undefined) qs.minPrice = String(params.minPrice);
  if (params.maxPrice !== undefined) qs.maxPrice = String(params.maxPrice);
  if (params.page !== undefined) qs.page = String(params.page);
  if (params.limit !== undefined) qs.limit = String(params.limit);

  const res = await api.get<SearchResult>('/search', { params: qs });
  return res.data;
}
