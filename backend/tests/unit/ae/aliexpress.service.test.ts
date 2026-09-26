import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AliExpressService } from '../../../src/services/aliexpress/aliexpress.service.js';
import type { CacheService } from '../../../src/interfaces/CacheService.js';
import { setupUndiciMock, type MockSetup } from '../../helpers/undiciMock.js';

function inMemoryCache(): CacheService {
  const store = new Map<string, unknown>();
  return {
    get: <T>(key: string) => Promise.resolve(store.get(key) as T | undefined),
    set: <T>(key: string, value: T) => {
      store.set(key, value);
      return Promise.resolve();
    },
    delete: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
  } as unknown as CacheService;
}

describe('AliExpressService', () => {
  const ORIGIN = 'https://api-sg.aliexpress.com';
  let mock: MockSetup;
  let cache: CacheService;
  let svc: AliExpressService;

  beforeEach(() => {
    mock = setupUndiciMock(ORIGIN);
    cache = inMemoryCache();
    svc = new AliExpressService({ cache });
    process.env.AE_APP_KEY = process.env.AE_APP_KEY || 'ae-app-key-test';
    process.env.AE_APP_SECRET = process.env.AE_APP_SECRET || 'ae-app-secret-test';
    process.env.AE_TRACKING_ID = process.env.AE_TRACKING_ID || 'ae-tracking-test';
  });
  afterEach(() => {
    mock.restore();
  });

  it('searchItems normaliza AE → UnifiedProduct y pagina', async () => {
    mock.pool.intercept({ path: /\/sync\?/, method: 'GET' }).reply(200, {
      aliexpress_affiliate_product_query_response: {
        resp_result: {
          resp_code: 200,
          result: {
            total_record_count: 87,
            products: {
              product: [
                {
                  product_id: 100200300,
                  product_title: 'Audífonos Bluetooth TWS',
                  product_main_image_url: 'http://ae/img/1.jpg',
                  target_sale_price: '12.99',
                  promotion_link: 'http://ae/promo/100200300',
                },
              ],
            },
          },
        },
      },
    });

    const result = await svc.searchItems({ q: 'audifonos', country: 'CO' });

    expect(result.pagination.total).toBe(87);
    expect(result.data).toHaveLength(1);
    const p = result.data[0];
    expect(p?.source).toBe('ALIEXPRESS');
    expect(p?.externalId).toBe('100200300');
    expect(p?.title).toBe('Audífonos Bluetooth TWS');
    expect(p?.price).toBe(12.99);
    expect(p?.currency).toBe('USD');
    expect(p?.productUrl).toBe('http://ae/promo/100200300');
  });

  it('searchItems usa cache: segunda llamada NO golpea upstream', async () => {
    mock.pool.intercept({ path: /\/sync\?/, method: 'GET' }).reply(200, {
      aliexpress_affiliate_product_query_response: {
        resp_result: { result: { total_record_count: 0, products: { product: [] } } },
      },
    });

    await svc.searchItems({ q: 'cached', country: 'CO' });
    // segunda llamada: si no estuviera cacheado, el mock (con un solo
    // intercept registrado) tiraría "no match" al no encontrar el request.
    const second = await svc.searchItems({ q: 'cached', country: 'CO' });
    expect(second.pagination.total).toBe(0);
  });

  it('getItem trae el detalle de un producto por ID y lo normaliza', async () => {
    mock.pool.intercept({ path: /\/sync\?/, method: 'GET' }).reply(200, {
      aliexpress_affiliate_productdetail_get_response: {
        resp_result: {
          resp_code: 200,
          result: {
            products: {
              product: [
                {
                  product_id: 555666,
                  product_title: 'Mini parlante Bluetooth',
                  product_main_image_url: 'http://ae/img/2.jpg',
                  target_sale_price: '9.50',
                  promotion_link: 'http://ae/promo/555666',
                },
              ],
            },
          },
        },
      },
    });

    const product = await svc.getItem('555666', 'CO');

    expect(product.externalId).toBe('555666');
    expect(product.source).toBe('ALIEXPRESS');
    expect(product.price).toBe(9.5);
    expect(product.currency).toBe('USD');
    expect(product.country).toBe('CO');
  });

  it('getItem usa cache: segunda llamada NO golpea upstream', async () => {
    mock.pool.intercept({ path: /\/sync\?/, method: 'GET' }).reply(200, {
      aliexpress_affiliate_productdetail_get_response: {
        resp_result: { result: { products: { product: [{ product_id: 1, product_title: 'X' }] } } },
      },
    });

    await svc.getItem('1', 'CO');
    const second = await svc.getItem('1', 'CO');
    expect(second.externalId).toBe('1');
  });

  it('getItem lanza upstream_error si el producto no existe', async () => {
    mock.pool.intercept({ path: /\/sync\?/, method: 'GET' }).reply(200, {
      aliexpress_affiliate_productdetail_get_response: {
        resp_result: { result: { products: { product: [] } } },
      },
    });

    await expect(svc.getItem('no-existe', 'CO')).rejects.toMatchObject({ statusCode: 502 });
  });

  it('propaga error_response de AliExpress como upstream_error', async () => {
    mock.pool.intercept({ path: /\/sync\?/, method: 'GET' }).reply(200, {
      error_response: { code: 'IncompleteSignature', msg: 'Signature verification failed' },
    });

    await expect(svc.searchItems({ q: 'boom', country: 'CO' })).rejects.toMatchObject({
      statusCode: 502,
    });
  });
});
