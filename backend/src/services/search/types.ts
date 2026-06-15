import type { Source, Currency } from '@prisma/client';

// Shape unificado de un producto sin importar la fuente (ML, AE futuro).
// El frontend solo necesita este tipo; cada servicio (mercadolibre, aliexpress)
// normaliza su respuesta upstream a esto.

export interface UnifiedProduct {
  externalId: string;
  source: Source;
  title: string;
  imageUrl: string | null;
  productUrl: string;
  price: number; // siempre normalizado a número, decimal con 2 cifras lo guarda Prisma
  currency: Currency;
  country: string; // ISO-2 / mapping de site_id
  sellerNickname?: string;
  shipping?: { free: boolean };
  condition?: 'new' | 'used' | 'unspecified';
}

export interface SearchParams {
  q: string;
  country?: string; // ej "CO", "MX". Mapea a site_id de ML
  source?: 'ML' | 'ALIEXPRESS' | 'both';
  minPrice?: number;
  maxPrice?: number;
  page?: number; // 1-based
  limit?: number; // por fuente
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
