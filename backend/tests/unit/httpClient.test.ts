import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { httpRequest } from '../../src/utils/httpClient.js';
import { AppError } from '../../src/utils/errors.js';
import { setupUndiciMock, type MockSetup } from '../helpers/undiciMock.js';

describe('httpRequest', () => {
  const ORIGIN = 'https://upstream.test';
  let mock: MockSetup;

  beforeEach(() => {
    mock = setupUndiciMock(ORIGIN);
  });
  afterEach(() => {
    mock.restore();
  });

  it('parsea JSON en 2xx', async () => {
    mock.pool.intercept({ path: '/users/1', method: 'GET' }).reply(200, { id: 1, name: 'kairo' });

    const res = await httpRequest<{ id: number; name: string }>(`${ORIGIN}/users/1`);
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('kairo');
  });

  it('4xx (excepto 429) NO se reintenta y lanza AppError', async () => {
    mock.pool.intercept({ path: '/bad', method: 'GET' }).reply(400, { error: 'bad_request' });

    await expect(
      httpRequest(`${ORIGIN}/bad`, { retry: { attempts: 3, baseDelayMs: 5 } }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('5xx se reintenta hasta `attempts` veces', async () => {
    let calls = 0;
    mock.pool
      .intercept({ path: '/flaky', method: 'GET' })
      .reply(() => {
        calls += 1;
        return { statusCode: 503, data: '{"e":"down"}' };
      })
      .times(3);

    await expect(
      httpRequest(`${ORIGIN}/flaky`, { retry: { attempts: 3, baseDelayMs: 1 } }),
    ).rejects.toBeInstanceOf(AppError);
    expect(calls).toBe(3);
  });

  it('5xx luego 2xx: reintenta y termina con éxito', async () => {
    mock.pool.intercept({ path: '/recover', method: 'GET' }).reply(500, 'down').times(1);
    mock.pool.intercept({ path: '/recover', method: 'GET' }).reply(200, { ok: true });

    const res = await httpRequest<{ ok: boolean }>(`${ORIGIN}/recover`, {
      retry: { attempts: 3, baseDelayMs: 1 },
    });
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
  });

  it('401 propaga statusCode 401 (no se reintenta)', async () => {
    mock.pool.intercept({ path: '/protected', method: 'GET' }).reply(401, 'unauthorized');

    await expect(
      httpRequest(`${ORIGIN}/protected`, { retry: { attempts: 3, baseDelayMs: 1 } }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
