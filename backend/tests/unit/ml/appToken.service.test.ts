import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getAppToken,
  invalidateAppToken,
  _resetAppToken,
} from '../../../src/services/mercadolibre/appToken.service.js';
import { setupUndiciMock, type MockSetup } from '../../helpers/undiciMock.js';

describe('appToken service', () => {
  const ORIGIN = 'https://api.mercadolibre.com';
  let mock: MockSetup;

  beforeEach(() => {
    _resetAppToken();
    mock = setupUndiciMock(ORIGIN);
    process.env.ML_APP_ID = process.env.ML_APP_ID ?? 'app-id-test';
    process.env.ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET ?? 'client-secret-test';
  });
  afterEach(() => {
    mock.restore();
    _resetAppToken();
  });

  it('cachea el token: dos llamadas → un solo request upstream', async () => {
    mock.pool
      .intercept({ path: '/oauth/token', method: 'POST' })
      .reply(200, { access_token: 't-1', token_type: 'bearer', expires_in: 21600 });

    const a = await getAppToken();
    const b = await getAppToken();
    expect(a).toBe('t-1');
    expect(b).toBe('t-1');
    // mock se queja si hay calls no consumidos; aqui basta con haber registrado uno solo
    expect(() => mock.agent.assertNoPendingInterceptors()).not.toThrow();
  });

  it('coalescing: N llamadas concurrentes → un solo request upstream', async () => {
    let calls = 0;
    mock.pool.intercept({ path: '/oauth/token', method: 'POST' }).reply(() => {
      calls += 1;
      return {
        statusCode: 200,
        data: JSON.stringify({ access_token: 't-c', token_type: 'bearer', expires_in: 21600 }),
      };
    });

    const results = await Promise.all([getAppToken(), getAppToken(), getAppToken()]);
    expect(results.every((r) => r === 't-c')).toBe(true);
    expect(calls).toBe(1);
  });

  it('invalidate() fuerza un nuevo request en la siguiente llamada', async () => {
    mock.pool
      .intercept({ path: '/oauth/token', method: 'POST' })
      .reply(200, { access_token: 't-1', token_type: 'bearer', expires_in: 21600 });
    mock.pool
      .intercept({ path: '/oauth/token', method: 'POST' })
      .reply(200, { access_token: 't-2', token_type: 'bearer', expires_in: 21600 });

    const a = await getAppToken();
    invalidateAppToken();
    const b = await getAppToken();
    expect(a).toBe('t-1');
    expect(b).toBe('t-2');
  });
});
