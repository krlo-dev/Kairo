import { Router } from 'express';
import { z } from 'zod';
import { getContainer } from '../config/di.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Errors } from '../utils/errors.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { ownership } from '../middleware/ownership.middleware.js';
import { createAlert } from '../services/alerts/createAlert.service.js';
import { updateAlert } from '../services/alerts/updateAlert.service.js';
import { deleteAlert } from '../services/alerts/deleteAlert.service.js';
import { listAlerts } from '../services/alerts/listAlerts.service.js';

export const alertsRouter = Router();

const MODE_VALUES = ['ONE_SHOT', 'RECURRING'] as const;
const DIRECTION_VALUES = ['DOWN', 'UP', 'PCT'] as const;

const createSchema = z.object({
  trackedProductId: z.string().min(1),
  mode: z.enum(MODE_VALUES).optional().default('ONE_SHOT'),
  direction: z.enum(DIRECTION_VALUES).optional().default('DOWN'),
  targetPrice: z.coerce.number().positive().nullable().optional().default(null),
  pctThreshold: z.coerce.number().nullable().optional().default(null),
  cooldownDays: z.coerce.number().int().min(1).max(90).optional().default(7),
  notifyEmail: z.boolean().optional().default(true),
  notifyWhatsapp: z.boolean().optional().default(false),
});

const updateSchema = z.object({
  mode: z.enum(MODE_VALUES).optional(),
  direction: z.enum(DIRECTION_VALUES).optional(),
  targetPrice: z.coerce.number().positive().nullable().optional(),
  pctThreshold: z.coerce.number().nullable().optional(),
  cooldownDays: z.coerce.number().int().min(1).max(90).optional(),
  notifyEmail: z.boolean().optional(),
  notifyWhatsapp: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  trackedProductId: z.string().min(1).optional(),
});

alertsRouter.get(
  '/alerts',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw Errors.unauthorized();
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw Errors.validation('Parámetros inválidos', parsed.error.flatten());
    }

    const { prisma } = getContainer();
    const result = await listAlerts(
      { prisma },
      req.user.id,
      parsed.data.page,
      parsed.data.limit,
      parsed.data.trackedProductId,
    );
    res.status(200).json(result);
  }),
);

alertsRouter.post(
  '/alerts',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw Errors.unauthorized();
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation('Datos inválidos', parsed.error.flatten());
    }

    const { prisma } = getContainer();
    const created = await createAlert({ prisma }, req.user.id, parsed.data);
    res.status(201).json({ data: created });
  }),
);

alertsRouter.put(
  '/alerts/:id',
  requireAuth,
  ownership('alert'),
  asyncHandler(async (req, res) => {
    if (!req.alert) throw Errors.notFound();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation('Datos inválidos', parsed.error.flatten());
    }

    const { prisma } = getContainer();
    const updated = await updateAlert({ prisma }, req.alert, parsed.data);
    res.status(200).json({ data: updated });
  }),
);

alertsRouter.delete(
  '/alerts/:id',
  requireAuth,
  ownership('alert'),
  asyncHandler(async (req, res) => {
    if (!req.alert) throw Errors.notFound();
    const { prisma } = getContainer();
    await deleteAlert({ prisma }, req.alert);
    res.status(204).send();
  }),
);
