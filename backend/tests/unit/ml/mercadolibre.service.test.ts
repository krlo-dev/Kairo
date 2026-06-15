import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MercadoLibreService } from '../../../src/services/mercadolibre/mercadolibre.service.js';
import { _resetAppToken } from '../../../src/services/mercadolibre/appToken.service.js';
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

describe('MercadoLibreService', () => {
  const ORIGIN = 'https://api.mercadolibre.com';
  let mock: MockSetup;
  let cache: CacheService;
  let svc: MercadoLibreService;

  beforeEach(() => {
    _resetAppToken();
    mock = setupUndiciMock(ORIGIN);
    cache = inMemoryCache();
    svc = new MercadoLibreService({ cache });
    process.env.ML_APP_ID = process.env.ML_APP_ID ?? 'app-id-test';
    process.env.ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET ?? 'client-secret-test';
  });
  afterEach(() => {
    mock.restore();
    _resetAppToken();
  });

  it('searchItems normaliza ML → UnifiedProduct y pagina', async () => {
    mock.pool
      .intercept({ path: '/oauth/token', method: 'POST' })
      .reply(200, { access_token: 'AT', token_type: 'bearer', expires_in: 21600 });
    mock.pool.intercept({ path: /\/sites\/MCO\/search/, method: 'GET' }).reply(200, {
      paging: { total: 142, offset: 0, limit: 30 },
      results: [
        {
          id: 'MCO123',
          title: 'iPhone 14 Pro',
          thumbnail: 'http://img/1.jpg',
          permalink: 'http://ml/item/MCO123',
          price: 4500000,
          currency_id: 'COP',
          condition: 'new',
          shipping: { free_shipping: true },
          seller: { nickname: 'Tienda X' },
        },
      ],
    });

    const result = await svc.searchItems({ q: 'iphone', country: 'CO' });

    expect(result.pagination.total).toBe(142);
    expect(result.pagination.totalPages).toBe(Math.ceil(142 / 30));
    expect(result.data).toHaveLength(1);
    const p = result.data[0];
    expect(p?.source).toBe('ML');
    expect(p?.externalId).toBe('MCO123');
    expect(p?.title).toBe('iPhone 14 Pro');
    expect(p?.price).toBe(4500000);
    expect(p?.currency).toBe('COP');
    expect(p?.country).toBe('CO');
    expect(p?.condition).toBe('new');
    expect(p?.shipping?.free).toBe(true);
    expect(p?.sellerNickname).toBe('Tienda X');
  });

  it('searchItems usa cache: segunda llamada NO golpea upstream', async () => {
    mock.pool
      .intercept({ path: '/oauth/token', method: 'POST' })
      .reply(200, { access_token: 'AT', token_type: 'bearer', expires_in: 21600 });
    mock.pool
      .intercept({ path: /\/sites\/MCO\/search/, method: 'GET' })
      .reply(200, { paging: { total: 1, offset: 0, limit: 30 }, results: [] });

    await svc.searchItems({ q: 'cached', country: 'CO' });
    // si no estuviera cacheado, la siguiente llamada haria un segundo /search
    // y como no hay intercept registrado el agent tiraría "no match".
    const second = await svc.searchItems({ q: 'cached', country: 'CO' });
    expect(second.pagination.total).toBe(1);
  });

  it('rechaza país no soportado', async () => {
    await expect(svc.searchItems({ q: 'x', country: 'ZZ' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('mapea país → site_id correctamente para MX', async () => {
    mock.pool
      .intercept({ path: '/oauth/token', method: 'POST' })
      .reply(200, { access_token: 'AT', token_type: 'bearer', expires_in: 21600 });
    let capturedPath = '';
    mock.pool.intercept({ path: /\/sites\/MLM\/search/, method: 'GET' }).reply((opts) => {
      capturedPath = opts.path;
      return {
        statusCode: 200,
        data: JSON.stringify({ paging: { total: 0, offset: 0, limit: 30 }, results: [] }),
      };
    });

    await svc.searchItems({ q: 'x', country: 'MX' });
    expect(capturedPath).toContain('/sites/MLM/search');
  });

  it('getItem normaliza detalle a UnifiedProduct', async () => {
    mock.pool
      .intercept({ path: '/oauth/token', method: 'POST' })
      .reply(200, { access_token: 'AT', token_type: 'bearer', expires_in: 21600 });
    mock.pool.intercept({ path: '/items/MCO999', method: 'GET' }).reply(200, {
      id: 'MCO999',
      title: 'Producto X',
      thumbnail: 'http://img/thumb.jpg',
      pictures: [{ url: 'http://img/big.jpg' }],
      permalink: 'http://ml/MCO999',
      price: 99000,
      currency_id: 'COP',
      condition: 'new',
      site_id: 'MCO',
    });

    const p = await svc.getItem('MCO999');
    expect(p.externalId).toBe('MCO999');
    expect(p.imageUrl).toBe('http://img/big.jpg'); // prefiere pictures[0] sobre thumbnail
    expect(p.currency).toBe('COP');
    expect(p.country).toBe('CO');
  });

  it('si app-token devuelve 401, invalida y reintenta una vez', async () => {
    // primer token
    mock.pool
      .intercept({ path: '/oauth/token', method: 'POST' })
      .reply(200, { access_token: 'OLD', token_type: 'bearer', expires_in: 21600 });
    // search devuelve 401 con OLD
    mock.pool.intercept({ path: /\/sites\/MCO\/search/, method: 'GET' }).reply(401, 'unauthorized');
    // segundo token (refresh)
    mock.pool
      .intercept({ path: '/oauth/token', method: 'POST' })
      .reply(200, { access_token: 'NEW', token_type: 'bearer', expires_in: 21600 });
    // search OK con NEW
    mock.pool
      .intercept({ path: /\/sites\/MCO\/search/, method: 'GET' })
      .reply(200, { paging: { total: 0, offset: 0, limit: 30 }, results: [] });

    const out = await svc.searchItems({ q: 'retry', country: 'CO' });
    expect(out.pagination.total).toBe(0);
  });
});

// Silencia ESLint sobre `vi` no usado en este file (algunos tests no lo
// usan directamente pero el helper de imports lo precisa).
void vi;
