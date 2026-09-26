import type { PrismaClient, TrackedProduct } from '@prisma/client';
import { AppError } from '../../utils/errors.js';
import { recordAudit } from '../../utils/auditLog.js';

export interface TrackingDeps {
  prisma: PrismaClient;
}

// Soft-delete (isActive=false) — nunca borramos la fila: el historial de
// precios (PriceHistory) sigue referenciándola y "reactivar" el mismo
// producto más adelante reusa esta misma fila (ver addTrackedProduct).
export async function removeTrackedProduct(
  deps: TrackingDeps,
  product: TrackedProduct,
): Promise<void> {
  if (product.lockedUntil && product.lockedUntil > new Date()) {
    throw new AppError(
      'product_locked',
      403,
      `Este producto está bloqueado hasta ${product.lockedUntil.toLocaleDateString('es-CO')} (plan FREE).`,
    );
  }

  await deps.prisma.trackedProduct.update({
    where: { id: product.id },
    data: { isActive: false },
  });

  await recordAudit(deps.prisma, {
    userId: product.userId,
    action: 'tracking_remove',
    resource: 'trackedProduct',
    resourceId: product.id,
  });
}
