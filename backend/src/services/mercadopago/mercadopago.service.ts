import { createHmac, timingSafeEqual } from 'node:crypto';
import { httpRequest } from '../../utils/httpClient.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

// Cliente delgado sobre la API de MercadoPago (Preapproval — suscripciones
// recurrentes). SPEC §8.4. Se prueba con credenciales dummy durante todo el
// sprint; la verificación fina contra respuestas reales de MP queda para el
// día que conectemos MP_ACCESS_TOKEN/MP_WEBHOOK_SECRET reales (plan del
// sprint: todas las features primero, credenciales reales al final).

const API_URL = 'https://api.mercadopago.com';

export interface CreatePreapprovalInput {
  email: string;
  planLabel: string;
  amountCOP: number;
  externalReference: string; // Subscription.id de Kairo — correlaciona el webhook
  backUrl: string;
}

export interface PreapprovalResult {
  id: string;
  initPoint: string;
}

interface MpPreapprovalCreateResponse {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
}

interface MpPreapprovalGetResponse {
  id: string;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled';
  external_reference?: string;
}

interface MpPaymentGetResponse {
  id: number | string;
  status: string; // approved | pending | in_process | rejected | refunded | cancelled | charged_back
  status_detail?: string;
  transaction_amount: number;
  currency_id: string;
  external_reference?: string;
  payment_method_id?: string;
}

export interface MpPayment {
  id: string;
  status: string;
  statusDetail: string | null;
  transactionAmount: number;
  currencyId: string;
  externalReference: string | null;
  paymentMethodId: string | null;
}

export interface MpPreapproval {
  id: string;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled';
  externalReference: string | null;
}

function authHeaders(): Record<string, string> {
  if (!env.MP_ACCESS_TOKEN) {
    throw new AppError(
      'mp_credentials_missing',
      500,
      'MercadoPago no está configurado (MP_ACCESS_TOKEN).',
    );
  }
  return { authorization: `Bearer ${env.MP_ACCESS_TOKEN}` };
}

export class MercadoPagoService {
  async createPreapproval(input: CreatePreapprovalInput): Promise<PreapprovalResult> {
    const res = await httpRequest<MpPreapprovalCreateResponse>(`${API_URL}/preapproval`, {
      method: 'POST',
      headers: authHeaders(),
      body: {
        reason: `Kairo — Plan ${input.planLabel}`,
        external_reference: input.externalReference,
        payer_email: input.email,
        back_url: input.backUrl,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: input.amountCOP,
          currency_id: 'COP',
        },
        status: 'pending',
      },
    });

    const initPoint = res.data.init_point ?? res.data.sandbox_init_point;
    if (!initPoint) {
      throw new AppError('mp_invalid_response', 502, 'MercadoPago no devolvió un link de pago.');
    }
    return { id: res.data.id, initPoint };
  }

  async getPreapproval(id: string): Promise<MpPreapproval> {
    const res = await httpRequest<MpPreapprovalGetResponse>(`${API_URL}/preapproval/${id}`, {
      headers: authHeaders(),
    });
    return {
      id: res.data.id,
      status: res.data.status,
      externalReference: res.data.external_reference ?? null,
    };
  }

  // 'paused' detiene los cobros futuros sin perder el preapproval (permite
  // reactivar); 'cancelled' es terminal en MP — usamos 'paused' para el
  // flujo de cancelación de Kairo, que mantiene acceso hasta fin de período.
  async updatePreapprovalStatus(
    id: string,
    status: 'paused' | 'authorized' | 'cancelled',
  ): Promise<void> {
    await httpRequest(`${API_URL}/preapproval/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: { status },
    });
  }

  async getPayment(id: string): Promise<MpPayment> {
    const res = await httpRequest<MpPaymentGetResponse>(`${API_URL}/v1/payments/${id}`, {
      headers: authHeaders(),
    });
    return {
      id: String(res.data.id),
      status: res.data.status,
      statusDetail: res.data.status_detail ?? null,
      transactionAmount: res.data.transaction_amount,
      currencyId: res.data.currency_id,
      externalReference: res.data.external_reference ?? null,
      paymentMethodId: res.data.payment_method_id ?? null,
    };
  }
}

// Verificación de firma de webhooks de MercadoPago (spec público):
// header `x-signature: ts=<epoch>,v1=<hmac_hex>`
// header `x-request-id: <request-id>`
// query param `data.id` (el id del recurso notificado, tal como MP lo manda
// en la URL del webhook, no el del body)
// manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
// firma esperada = HMAC-SHA256(manifest, MP_WEBHOOK_SECRET) en hex, comparada
// en tiempo constante contra v1.
export function verifyMpWebhookSignature(params: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
}): boolean {
  if (!env.MP_WEBHOOK_SECRET) return false;
  if (!params.xSignature || !params.xRequestId || !params.dataId) return false;

  const parts: Record<string, string> = {};
  for (const chunk of params.xSignature.split(',')) {
    const [key, value] = chunk.split('=').map((s) => s.trim());
    if (key && value) parts[key] = value;
  }
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.xRequestId};ts:${ts};`;
  const expectedHex = createHmac('sha256', env.MP_WEBHOOK_SECRET).update(manifest).digest('hex');

  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(v1, 'hex');
  if (expected.length === 0 || actual.length === 0 || expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(expected, actual);
}
