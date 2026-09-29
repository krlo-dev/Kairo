import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MercadoPagoService,
  verifyMpWebhookSignature,
} from '../../../src/services/mercadopago/mercadopago.service.js';
import { setupUndiciMock, type MockSetup } from '../../helpers/undiciMock.js';

describe('MercadoPagoService', () => {
  const ORIGIN = 'https://api.mercadopago.com';
  let mock: MockSetup;
  let svc: MercadoPagoService;

  beforeEach(() => {
    mock = setupUndiciMock(ORIGIN);
    svc = new MercadoPagoService();
  });
  afterEach(() => {
    mock.restore();
  });

  it('createPreapproval crea el preapproval y devuelve id + initPoint', async () => {
    mock.pool.intercept({ path: '/preapproval', method: 'POST' }).reply(201, {
      id: 'preapproval-123',
      init_point: 'https://mercadopago.com/checkout/preapproval-123',
    });

    const result = await svc.createPreapproval({
      email: 'user@example.com',
      planLabel: 'Pro',
      amountCOP: 29900,
      externalReference: 'sub-1',
      backUrl: 'https://kairo.com.co/settings',
    });

    expect(result).toEqual({
      id: 'preapproval-123',
      initPoint: 'https://mercadopago.com/checkout/preapproval-123',
    });
  });

  it('createPreapproval lanza mp_invalid_response si MP no devuelve init_point', async () => {
    mock.pool.intercept({ path: '/preapproval', method: 'POST' }).reply(201, { id: 'x' });

    await expect(
      svc.createPreapproval({
        email: 'user@example.com',
        planLabel: 'Pro',
        amountCOP: 29900,
        externalReference: 'sub-1',
        backUrl: 'https://kairo.com.co/settings',
      }),
    ).rejects.toMatchObject({ code: 'mp_invalid_response' });
  });

  it('getPayment normaliza la respuesta de MP', async () => {
    mock.pool.intercept({ path: '/v1/payments/999', method: 'GET' }).reply(200, {
      id: 999,
      status: 'approved',
      transaction_amount: 29900,
      currency_id: 'COP',
      external_reference: 'sub-1',
      payment_method_id: 'visa',
    });

    const payment = await svc.getPayment('999');
    expect(payment).toEqual({
      id: '999',
      status: 'approved',
      statusDetail: null,
      transactionAmount: 29900,
      currencyId: 'COP',
      externalReference: 'sub-1',
      paymentMethodId: 'visa',
    });
  });

  it('getPreapproval normaliza la respuesta de MP', async () => {
    mock.pool.intercept({ path: '/preapproval/preapproval-123', method: 'GET' }).reply(200, {
      id: 'preapproval-123',
      status: 'cancelled',
      external_reference: 'sub-1',
    });

    const preapproval = await svc.getPreapproval('preapproval-123');
    expect(preapproval).toEqual({
      id: 'preapproval-123',
      status: 'cancelled',
      externalReference: 'sub-1',
    });
  });

  it('updatePreapprovalStatus manda PUT con el status pedido', async () => {
    mock.pool.intercept({ path: '/preapproval/preapproval-123', method: 'PUT' }).reply(200, {});
    await expect(svc.updatePreapprovalStatus('preapproval-123', 'paused')).resolves.toBeUndefined();
  });
});

describe('verifyMpWebhookSignature', () => {
  const secret = process.env.MP_WEBHOOK_SECRET as string;

  function sign(manifest: string): string {
    return createHmac('sha256', secret).update(manifest).digest('hex');
  }

  it('acepta una firma válida', () => {
    const dataId = 'abc123';
    const requestId = 'req-1';
    const ts = '1700000000';
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
    const v1 = sign(manifest);

    const ok = verifyMpWebhookSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: requestId,
      dataId,
    });
    expect(ok).toBe(true);
  });

  it('rechaza una firma alterada', () => {
    const dataId = 'abc123';
    const requestId = 'req-1';
    const ts = '1700000000';

    const ok = verifyMpWebhookSignature({
      xSignature: `ts=${ts},v1=${'0'.repeat(64)}`,
      xRequestId: requestId,
      dataId,
    });
    expect(ok).toBe(false);
  });

  it('rechaza si falta x-signature o x-request-id', () => {
    expect(verifyMpWebhookSignature({ xSignature: undefined, xRequestId: 'r', dataId: 'x' })).toBe(
      false,
    );
    expect(
      verifyMpWebhookSignature({ xSignature: 'ts=1,v1=a', xRequestId: undefined, dataId: 'x' }),
    ).toBe(false);
  });
});
