import { httpRequest } from '../../utils/httpClient.js';
import type { CacheService } from '../../interfaces/CacheService.js';
import { AppError } from '../../utils/errors.js';
import { env } from '../../config/env.js';
import { signAliExpressParams } from '../../utils/aliexpressSign.js';
import type { SearchParams, SearchResult, UnifiedProduct } from '../search/types.js';

// AliExpress Open Platform (TOP) API — gateway único para todos los métodos.
const API_URL = 'https://api-sg.aliexpress.com/sync';
const METHOD = 'aliexpress.affiliate.product.query';
const DEFAULT_LIMIT = 30;

// NOTA: la forma exacta de la respuesta se ajusta contra la API real la
// primera vez que probemos con credenciales de AE Affiliates (ver
// docs/setup-local.md sección de integraciones externas). Esta forma sigue
// la documentación pública del método aliexpress.affiliate.product.query.
interface AeProduct {
  product_id: number | string;
  product_title: string;
  product_main_image_url?: string;
  target_sale_price?: string;
  promotion_link?: string;
  product_detail_url?: string;
}

interface AeQueryResponse {
  aliexpress_affiliate_product_query_response?: {
    resp_result?: {
      resp_code?: number;
      resp_msg?: string;
      result?: {
        total_record_count?: number;
        products?: { product: AeProduct[] };
      };
    };
  };
  error_response?: { code?: string; msg?: string };
}

export interface AliExpressServiceDeps {
  cache: CacheService;
}

function ensureConfigured(): void {
  if (!env.AE_APP_KEY || !env.AE_APP_SECRET || !env.AE_TRACKING_ID) {
    throw new AppError(
      'ae_credentials_missing',
      500,
      'Credenciales de AliExpress Affiliates no configuradas',
    );
  }
}

export class AliExpressService {
  constructor(private deps: AliExpressServiceDeps) {}

  async searchItems(params: SearchParams): Promise<SearchResult> {
    ensureConfigured();

    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, 50);
    const page = Math.max(params.page ?? 1, 1);
    const country = (params.country ?? 'CO').toUpperCase();

    const cacheKey = mkSearchKey(params, page, limit);
    const cached = await this.deps.cache.get<SearchResult>(cacheKey);
    if (cached) return cached;

    const business: Record<string, string> = {
      keywords: params.q,
      page_no: String(page),
      page_size: String(limit),
      target_currency: 'USD',
      target_language: 'ES',
      tracking_id: env.AE_TRACKING_ID,
      ship_to_country: country,
    };
    if (params.minPrice !== undefined) business.min_sale_price = String(params.minPrice);
    if (params.maxPrice !== undefined) business.max_sale_price = String(params.maxPrice);

    const data = await this.callApi<AeQueryResponse>(business);

    if (data.error_response) {
      throw new AppError(
        'upstream_error',
        502,
        `AliExpress: ${data.error_response.msg ?? data.error_response.code ?? 'error desconocido'}`,
      );
    }

    const respResult = data.aliexpress_affiliate_product_query_response?.resp_result;
    if (!respResult?.result) {
      throw new AppError(
        'upstream_error',
        502,
        `AliExpress: ${respResult?.resp_msg ?? 'respuesta inesperada'}`,
      );
    }

    const products = respResult.result.products?.product ?? [];
    const total = respResult.result.total_record_count ?? products.length;

    const result: SearchResult = {
      data: products.map((p) => this.normalizeProduct(p, country)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
    // TTL corto (5min) — igual que ML, para compartir cache entre usuarios
    // sin pegarle demasiado tiempo seguido a la cuota del Affiliate API.
    await this.deps.cache.set(cacheKey, result, 300);
    return result;
  }

  private async callApi<T>(businessParams: Record<string, string>): Promise<T> {
    const allParams: Record<string, string> = {
      app_key: env.AE_APP_KEY,
      timestamp: String(Date.now()),
      sign_method: 'sha256',
      method: METHOD,
      v: '2.0',
      format: 'json',
      ...businessParams,
    };
    const sign = signAliExpressParams(allParams, env.AE_APP_SECRET);
    const qs = new URLSearchParams({ ...allParams, sign });

    const res = await httpRequest<T>(`${API_URL}?${qs.toString()}`);
    return res.data;
  }

  private normalizeProduct(p: AeProduct, country: string): UnifiedProduct {
    return {
      externalId: String(p.product_id),
      source: 'ALIEXPRESS',
      title: p.product_title,
      imageUrl: p.product_main_image_url ?? null,
      productUrl: p.promotion_link ?? p.product_detail_url ?? '',
      price: p.target_sale_price ? Number(p.target_sale_price) : 0,
      currency: 'USD',
      country,
      condition: 'new',
    };
  }
}

function mkSearchKey(p: SearchParams, page: number, limit: number): string {
  return `ae:search:${p.q}:${p.country ?? ''}:${p.minPrice ?? ''}:${p.maxPrice ?? ''}:${page}:${limit}`;
}
