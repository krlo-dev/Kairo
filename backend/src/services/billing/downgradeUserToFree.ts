import type { Prisma, PrismaClient } from '@prisma/client';
import { PLAN_LIMITS } from '../../utils/planLimits.js';

type Tx = PrismaClient | Prisma.TransactionClient;

// Aplica el downgrade a FREE (SPEC §8.4, reglas de downgrade): si el user
// tiene más productos rastreados activos que el cupo de FREE, conserva los
// N más recientes (por addedAt) y desactiva el resto — soft delete, nunca
// borra el historial de precios asociado. Se usa tanto desde el job nocturno
// (cancelAtPeriodEnd vencido) como desde el webhook (cancelación desde MP).
export async function downgradeUserToFree(
  tx: Tx,
  userId: string,
): Promise<{ deactivated: number }> {
  await tx.user.update({ where: { id: userId }, data: { plan: 'FREE' } });

  const maxFree = PLAN_LIMITS.FREE.maxTrackedProducts;
  const active = await tx.trackedProduct.findMany({
    where: { userId, isActive: true },
    orderBy: { addedAt: 'desc' },
    select: { id: true },
  });

  if (active.length <= maxFree) {
    return { deactivated: 0 };
  }

  const toDeactivate = active.slice(maxFree).map((p) => p.id);
  await tx.trackedProduct.updateMany({
    where: { id: { in: toDeactivate } },
    data: { isActive: false },
  });
  return { deactivated: toDeactivate.length };
}
