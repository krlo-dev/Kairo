import { httpRequest } from '../../utils/httpClient.js';
import type { CacheService } from '../../interfaces/CacheService.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../logger/pino.js';
import { getAppToken, invalidateAppToken } from './appToken.service.js';
import type { SearchParams, SearchResult, UnifiedProduct } from '../search/types.js';

// Mapeo de país ISO-2 → site_id de Mercado Libre.
// Solo los países soportados por v.1 (FREE solo CO; PRO/COMERCIANTE LATAM).
const ML_SITE_BY_COUNTRY: Record<string, string> = {
  CO: 'MCO',
  MX: 'MLM',
  AR: 'MLA',
  CL: 'MLC',
  BR: 'MLB',
  PE: 'MPE',
  UY: 'MLU',
  VE: 'MLV',
};

const ML_CURRENCY_BY_SITE: Record<string, 'COP' | 'MXN' | 'ARS' | 'CLP' | 'BRL' | 'PEN' | 'USD'> = {
  MCO: 'COP',
  MLM: 'MXN',
  MLA: 'ARS',
  MLC: 'CLP',
  MLB: 'BRL',
  MPE: 'PEN',
  MLU: 'USD', // simplificacion para uy/ve hasta v.2
  MLV: 'USD',
};

const DEFAULT_LIMIT = 30;

interface MlSearchItem {
  id: string;
  title: string;
  thumbnail?: string;
  permalink: string;
  price: number;
  currency_id: string;
  condition?: string;
  shipping?: { free_shipping?: boolean };
  seller?: { nickname?: string };
}

interface MlSearchResponse {
  paging: { total: number; offset: number; limit: number };
  results: MlSearchItem[];
}

interface MlItemDetail {
  id: string;
  title: string;
  thumbnail?: string;
  pictures?: { url: string }[];
  permalink: string;
  price: number;
  currency_id: string;
  condition?: string;
  shipping?: { free_shipping?: boolean };
  seller_id?: number;
  site_id?: string;
}

export interface MercadoLibreServiceDeps {
  cache: CacheService;
}

export class MercadoLibreService {
  constructor(private deps: MercadoLibreServiceDeps) {}

  async searchItems(params: SearchParams): Promise<SearchResult> {
    const country = (params.country ?? 'CO').toUpperCase();
    const siteId = ML_SITE_BY_COUNTRY[country];
    if (!siteId) {
      throw new AppError('country_not_supported', 400, `País no soportado por ML: ${country}`);
    }
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, 50);
    const page = Math.max(params.page ?? 1, 1);
    const offset = (page - 1) * limit;

    const cacheKey = mkSearchKey(siteId, params, offset, limit);
    const cached = await this.deps.cache.get<SearchResult>(cacheKey);
    if (cached) return cached;

    const qs = new URLSearchParams({
      q: params.q,
      limit: String(limit),
      offset: String(offset),
    });
    if (params.minPrice !== undefined) qs.set('price', `${params.minPrice}-*`);
    if (params.maxPrice !== undefined) {
      // ML acepta rangos "min-max" en el mismo parametro price.
      const min = params.minPrice ?? 0;
      qs.set('price', `${min}-${params.maxPrice}`);
    }

    const url = `https://api.mercadolibre.com/sites/${siteId}/search?${qs.toString()}`;
    const data = await this.fetchWithAppToken<MlSearchResponse>(url);

    const result: SearchResult = {
      data: data.results.map((it) => this.normalizeSearchItem(it, siteId, country)),
      pagination: {
        page,
        limit,
        total: data.paging.total,
        totalPages: Math.max(1, Math.ceil(data.paging.total / limit)),
      },
    };
    // TTL corto: 5 minutos. ML cobra rate limit, queremos compartir entre users.
    await this.deps.cache.set(cacheKey, result, 300);
    return result;
  }

  async getItem(externalId: string): Promise<UnifiedProduct> {
    const cacheKey = `ml:item:${externalId}`;
    const cached = await this.deps.cache.get<UnifiedProduct>(cacheKey);
    if (cached) return cached;

    const url = `https://api.mercadolibre.com/items/${encodeURIComponent(externalId)}`;
    const data = await this.fetchWithAppToken<MlItemDetail>(url);

    const siteId = data.site_id ?? 'MCO';
    const country = Object.entries(ML_SITE_BY_COUNTRY).find(([, s]) => s === siteId)?.[0] ?? 'CO';
    const product: UnifiedProduct = {
      externalId: data.id,
      source: 'ML',
      title: data.title,
      imageUrl: data.pictures?.[0]?.url ?? data.thumbnail ?? null,
      productUrl: data.permalink,
      price: data.price,
      currency: ML_CURRENCY_BY_SITE[siteId] ?? 'USD',
      country,
      condition: mapCondition(data.condition),
      ...(data.shipping?.free_shipping !== undefined
        ? { shipping: { free: data.shipping.free_shipping } }
        : {}),
    };
    // TTL más largo: detalle cambia poco (3h).
    await this.deps.cache.set(cacheKey, product, 3 * 60 * 60);
    return product;
  }

  /**
   * Wrapper que añade Authorization Bearer y maneja 401 (token expirado):
   * invalida el cache de app-token y reintenta UNA vez con uno nuevo.
   */
  private async fetchWithAppToken<T>(url: string): Promise<T> {
    const token = await getAppToken();
    try {
      const res = await httpRequest<T>(url, {
        headers: { authorization: `Bearer ${token}` },
      });
      return res.data;
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 401) {
        logger.warn('ml app-token rejected (401), refreshing and retrying');
        invalidateAppToken();
        const fresh = await getAppToken();
        const res = await httpRequest<T>(url, {
          headers: { authorization: `Bearer ${fresh}` },
        });
        return res.data;
      }
      throw err;
    }
  }

  private normalizeSearchItem(it: MlSearchItem, siteId: string, country: string): UnifiedProduct {
    return {
      externalId: it.id,
      source: 'ML',
      title: it.title,
      imageUrl: it.thumbnail ?? null,
      productUrl: it.permalink,
      price: it.price,
      currency: ML_CURRENCY_BY_SITE[siteId] ?? 'USD',
      country,
      condition: mapCondition(it.condition),
      ...(it.seller?.nickname ? { sellerNickname: it.seller.nickname } : {}),
      ...(it.shipping?.free_shipping !== undefined
        ? { shipping: { free: it.shipping.free_shipping } }
        : {}),
    };
  }
}

function mapCondition(c: string | undefined): 'new' | 'used' | 'unspecified' {
  if (c === 'new') return 'new';
  if (c === 'used') return 'used';
  return 'unspecified';
}

function mkSearchKey(siteId: string, p: SearchParams, offset: number, limit: number): string {
  return `ml:search:${siteId}:${p.q}:${p.minPrice ?? ''}:${p.maxPrice ?? ''}:${offset}:${limit}`;
}
