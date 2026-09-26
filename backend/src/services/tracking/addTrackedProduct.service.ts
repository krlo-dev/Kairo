import type { PrismaClient, TrackedProduct } from '@prisma/client';
import { AppError } from '../../utils/errors.js';
import { getLimitsFor } from '../../utils/planLimits.js';
import { recordAudit } from '../../utils/auditLog.js';
import type { AddTrackingInput } from './types.js';

// Plan FREE: bloqueo de 30 días desde que se agrega — no calendario mensual,
// sino ventana rodante desde `addedAt`. Ver SPEC §10 "Plan FREE — bloqueo".
const FREE_LOCK_MS = 30 * 24 * 60 * 60 * 1000;

export interface TrackingDeps {
  prisma: PrismaClient;
}

export async function addTrackedProduct(
  deps: TrackingDeps,
  userId: string,
  input: AddTrackingInput,
): Promise<TrackedProduct> {
  const user = await deps.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const limits = getLimitsFor(user.plan);

  const allowedSources: readonly string[] = limits.sources;
  if (!allowedSources.includes(input.source)) {
    throw new AppError('source_not_allowed', 403, 'Tu plan no permite rastrear esta fuente.');
  }

  // Puede existir una fila previa del mismo producto si el user lo rastreó
  // y luego lo eliminó (isActive=false) — @@unique([userId, externalId,
  // source]) impide un segundo INSERT, así que "reactivamos" esa fila en
  // vez de crear una nueva (nuevo addedAt + lockedUntil, per SPEC §10).
  const existing = await deps.prisma.trackedProduct.findUnique({
    where: {
      userId_externalId_source: {
        userId,
        externalId: input.externalId,
        source: input.source,
      },
    },
  });

  if (existing?.isActive) {
    throw new AppError('already_tracked', 409, 'Ya estás rastreando este producto.');
  }

  const activeCount = await deps.prisma.trackedProduct.count({
    where: { userId, isActive: true },
  });
  if (activeCount >= limits.maxTrackedProducts) {
    throw new AppError(
      'limit_reached',
      403,
      `Tu plan permite rastrear hasta ${limits.maxTrackedProducts} productos.`,
    );
  }

  const lockedUntil = user.plan === 'FREE' ? new Date(Date.now() + FREE_LOCK_MS) : null;

  const data = {
    title: input.title,
    imageUrl: input.imageUrl,
    productUrl: input.productUrl,
    currentPrice: input.currentPrice,
    currency: input.currency,
    country: input.country,
    isActive: true,
    addedAt: new Date(),
    lockedUntil,
  };

  const result = existing
    ? await deps.prisma.trackedProduct.update({ where: { id: existing.id }, data })
    : await deps.prisma.trackedProduct.create({
        data: {
          ...data,
          userId,
          externalId: input.externalId,
          source: input.source,
        },
      });

  await recordAudit(deps.prisma, {
    userId,
    action: 'tracking_add',
    resource: 'trackedProduct',
    resourceId: result.id,
  });

  return result;
}
