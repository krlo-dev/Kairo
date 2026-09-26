import { Router } from 'express';
import { z } from 'zod';
import { getContainer } from '../config/di.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Errors } from '../utils/errors.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { ownership } from '../middleware/ownership.middleware.js';
import { addTrackedProduct } from '../services/tracking/addTrackedProduct.service.js';
import { removeTrackedProduct } from '../services/tracking/removeTrackedProduct.service.js';
import { listTrackedProducts } from '../services/tracking/listTrackedProducts.service.js';
import { getPriceHistory } from '../services/tracking/getPriceHistory.service.js';

export const trackingRouter = Router();

const CURRENCY_VALUES = ['COP', 'USD', 'MXN', 'ARS', 'CLP', 'BRL', 'PEN'] as const;

const addSchema = z.object({
  externalId: z.string().min(1).max(120),
  source: z.enum(['ML', 'ALIEXPRESS']),
  title: z.string().trim().min(1).max(300),
  imageUrl: z.string().url().nullable().optional(),
  productUrl: z.string().url(),
  currentPrice: z.coerce.number().positive(),
  currency: z.enum(CURRENCY_VALUES),
  country: z.string().length(2),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const historyQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
});

trackingRouter.get(
  '/tracking',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw Errors.unauthorized();
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw Errors.validation('Parámetros inválidos', parsed.error.flatten());
    }

    const { prisma } = getContainer();
    const result = await listTrackedProducts(
      { prisma },
      req.user.id,
      parsed.data.page,
      parsed.data.limit,
    );
    res.status(200).json(result);
  }),
);

trackingRouter.post(
  '/tracking',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw Errors.unauthorized();
    const parsed = addSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation('Datos inválidos', parsed.error.flatten());
    }

    const { prisma } = getContainer();
    const created = await addTrackedProduct({ prisma }, req.user.id, {
      ...parsed.data,
      imageUrl: parsed.data.imageUrl ?? null,
    });
    res.status(201).json({ data: created });
  }),
);

trackingRouter.get('/tracking/:id', requireAuth, ownership('trackedProduct'), (req, res) => {
  res.status(200).json({ data: req.trackedProduct });
});

trackingRouter.get(
  '/tracking/:id/history',
  requireAuth,
  ownership('trackedProduct'),
  asyncHandler(async (req, res) => {
    if (!req.trackedProduct) throw Errors.notFound();
    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw Errors.validation('Parámetros inválidos', parsed.error.flatten());
    }

    const { prisma } = getContainer();
    const data = await getPriceHistory({ prisma }, req.trackedProduct.id, parsed.data.days);
    res.status(200).json({ data });
  }),
);

trackingRouter.delete(
  '/tracking/:id',
  requireAuth,
  ownership('trackedProduct'),
  asyncHandler(async (req, res) => {
    if (!req.trackedProduct) throw Errors.notFound();
    const { prisma } = getContainer();
    await removeTrackedProduct({ prisma }, req.trackedProduct);
    res.status(204).send();
  }),
);
