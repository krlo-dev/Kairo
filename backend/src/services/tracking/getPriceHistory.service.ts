import type { PrismaClient } from '@prisma/client';
import type { PricePoint } from './types.js';

export interface TrackingDeps {
  prisma: PrismaClient;
}

/**
 * Historial de precios de un producto rastreado, para el gráfico de
 * ProductDetail (Recharts, Fase 4). `days` acota la ventana — por defecto
 * 30 días, tope 365 para no cargar el rango completo de golpe.
 */
export async function getPriceHistory(
  deps: TrackingDeps,
  trackedProductId: string,
  days: number,
): Promise<PricePoint[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await deps.prisma.priceHistory.findMany({
    where: { trackedProductId, recordedAt: { gte: cutoff } },
    orderBy: { recordedAt: 'asc' },
  });

  return rows.map((row) => ({
    recordedAt: row.recordedAt,
    price: Number(row.price),
    currency: row.currency,
  }));
}
