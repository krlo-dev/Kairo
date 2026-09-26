import { beforeEach, describe, expect, it } from 'vitest';
import { getPriceHistory } from '../../../src/services/tracking/getPriceHistory.service.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';

describe('getPriceHistory', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('mapea PriceHistory a puntos {recordedAt, price, currency} en orden ascendente', async () => {
    const rows = [
      { recordedAt: new Date('2026-01-01'), price: 100000 as unknown, currency: 'COP' as const },
      { recordedAt: new Date('2026-01-02'), price: 95000 as unknown, currency: 'COP' as const },
    ];
    prisma.priceHistory.findMany.mockResolvedValueOnce(rows);

    const result = await getPriceHistory({ prisma: asPrisma(prisma) }, 'tp-1', 30);

    expect(result).toEqual([
      { recordedAt: rows[0]!.recordedAt, price: 100000, currency: 'COP' },
      { recordedAt: rows[1]!.recordedAt, price: 95000, currency: 'COP' },
    ]);
  });

  it('filtra por trackedProductId y por ventana de días, ordenando asc', async () => {
    prisma.priceHistory.findMany.mockResolvedValueOnce([]);

    await getPriceHistory({ prisma: asPrisma(prisma) }, 'tp-1', 7);

    const arg = prisma.priceHistory.findMany.mock.calls[0]?.[0] as {
      where: { trackedProductId: string; recordedAt: { gte: Date } };
      orderBy: { recordedAt: string };
    };
    expect(arg.where.trackedProductId).toBe('tp-1');
    expect(arg.orderBy).toEqual({ recordedAt: 'asc' });
    const deltaMs = Date.now() - arg.where.recordedAt.gte.getTime();
    expect(deltaMs).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
    expect(deltaMs).toBeLessThan(7.1 * 24 * 60 * 60 * 1000);
  });

  it('devuelve arreglo vacío si no hay historial', async () => {
    prisma.priceHistory.findMany.mockResolvedValueOnce([]);

    const result = await getPriceHistory({ prisma: asPrisma(prisma) }, 'tp-sin-historial', 30);

    expect(result).toEqual([]);
  });
});
