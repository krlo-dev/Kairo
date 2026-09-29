import { Router } from 'express';
import { z } from 'zod';
import { getContainer } from '../config/di.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Errors } from '../utils/errors.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logger } from '../logger/pino.js';
import {
  MercadoPagoService,
  verifyMpWebhookSignature,
} from '../services/mercadopago/mercadopago.service.js';
import { getPlans } from '../services/billing/plans.js';
import { checkout } from '../services/billing/checkout.service.js';
import { getBillingStatus } from '../services/billing/getStatus.service.js';
import { cancelSubscription } from '../services/billing/cancelSubscription.service.js';
import { reactivateSubscription } from '../services/billing/reactivateSubscription.service.js';
import { processMpWebhook } from '../services/billing/processWebhook.service.js';

export const billingRouter = Router();

const checkoutSchema = z.object({
  plan: z.enum(['PRO', 'COMERCIANTE']),
});

// GET /billing/plans — info pública de planes (sin auth: útil para una
// futura página de pricing sin login).
billingRouter.get('/billing/plans', (_req, res) => {
  res.status(200).json({ data: getPlans() });
});

billingRouter.post(
  '/billing/checkout',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw Errors.unauthorized();
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation('Datos inválidos', parsed.error.flatten());
    }

    const { prisma } = getContainer();
    const mp = new MercadoPagoService();
    const result = await checkout({ prisma, mp }, req.user.id, parsed.data.plan);
    res.status(200).json({ data: result });
  }),
);

billingRouter.get(
  '/billing/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw Errors.unauthorized();
    const { prisma } = getContainer();
    const result = await getBillingStatus({ prisma }, req.user.id);
    res.status(200).json({ data: result });
  }),
);

billingRouter.post(
  '/billing/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw Errors.unauthorized();
    const { prisma } = getContainer();
    const mp = new MercadoPagoService();
    const result = await cancelSubscription({ prisma, mp }, req.user.id);
    res.status(200).json({ data: result });
  }),
);

billingRouter.post(
  '/billing/reactivate',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw Errors.unauthorized();
    const { prisma } = getContainer();
    const mp = new MercadoPagoService();
    const result = await reactivateSubscription({ prisma, mp }, req.user.id);
    res.status(200).json({ data: result });
  }),
);

// POST /billing/webhook — MercadoPago. Sin requireAuth (MP no manda nuestras
// cookies) y exento de CSRF (ver csrf.middleware.ts). Verificamos la firma
// HMAC en su lugar. Siempre respondemos 200 salvo firma inválida (401): un
// 5xx haría que MP reintente indefinidamente algo que ya sabemos que no
// vamos a poder procesar.
const webhookBodySchema = z.object({
  type: z.string().optional(),
  action: z.string().optional(),
  data: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
});

billingRouter.post(
  '/billing/webhook',
  asyncHandler(async (req, res) => {
    const dataIdFromQuery = req.query['data.id'];
    const parsedBody = webhookBodySchema.safeParse(req.body);
    const bodyDataId = parsedBody.success ? parsedBody.data.data?.id : undefined;
    const dataId =
      (typeof dataIdFromQuery === 'string' ? dataIdFromQuery : undefined) ??
      (bodyDataId !== undefined ? String(bodyDataId) : undefined);
    const type = parsedBody.success ? (parsedBody.data.type ?? parsedBody.data.action) : undefined;

    const validSignature = verifyMpWebhookSignature({
      xSignature: req.header('x-signature'),
      xRequestId: req.header('x-request-id'),
      dataId,
    });
    if (!validSignature) {
      logger.warn({ dataId, type }, 'mp webhook: firma inválida');
      throw Errors.unauthorized('Firma de webhook inválida');
    }

    if (!type || !dataId) {
      res.status(200).json({ received: true });
      return;
    }

    const { prisma, email } = getContainer();
    const mp = new MercadoPagoService();
    await processMpWebhook({ prisma, mp, email }, { type, dataId });

    res.status(200).json({ received: true });
  }),
);
