import { beforeEach, describe, expect, it } from 'vitest';
import { cleanupOldPriceHistoryOnce } from '../../../src/jobs/cleanup.job.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';

function daysAgo(d: number): Date {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000);
}

describe('cleanupOldPriceHistoryOnce', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('sin filas viejas no hace nada', async () => {
    prisma.priceHistory.findMany.mockResolvedValueOnce([]);

    const summary = await cleanupOldPriceHistoryOnce({ prisma: asPrisma(prisma) });

    expect(summary).toEqual({ scanned: 0, aggregated: 0, deleted: 0 });
    expect(prisma.priceAggregate.upsert).not.toHaveBeenCalled();
    expect(prisma.priceHistory.deleteMany).not.toHaveBeenCalled();
  });

  it('agrupa por (externalId, source, día) y calcula min/max/avg/close', async () => {
    const day = daysAgo(100);
    const rows = [
      {
        id: 'ph1',
        price: 100 as unknown,
        currency: 'COP' as const,
        recordedAt: new Date(day.getTime()),
        trackedProduct: { externalId: 'MLA1', source: 'ML' as const },
      },
      {
        id: 'ph2',
        price: 80 as unknown,
        currency: 'COP' as const,
        recordedAt: new Date(day.getTime() + 3600_000), // mismo día, 1h después
        trackedProduct: { externalId: 'MLA1', source: 'ML' as const },
      },
    ];
    prisma.priceHistory.findMany.mockResolvedValueOnce(rows);
    prisma.priceAggregate.upsert.mockResolvedValueOnce({});
    prisma.priceHistory.deleteMany.mockResolvedValueOnce({ count: 2 });

    const summary = await cleanupOldPriceHistoryOnce({ prisma: asPrisma(prisma) });

    expect(summary).toEqual({ scanned: 2, aggregated: 1, deleted: 2 });
    expect(prisma.priceAggregate.upsert).toHaveBeenCalledOnce();
    const upsertArg = prisma.priceAggregate.upsert.mock.calls[0]?.[0] as {
      create: {
        minPrice: number;
        maxPrice: number;
        avgPrice: number;
        closePrice: number;
        samples: number;
      };
    };
    expect(upsertArg.create.minPrice).toBe(80);
    expect(upsertArg.create.maxPrice).toBe(100);
    expect(upsertArg.create.avgPrice).toBe(90);
    expect(upsertArg.create.closePrice).toBe(80); // el más reciente de ese día
    expect(upsertArg.create.samples).toBe(2);

    const deleteArg = prisma.priceHistory.deleteMany.mock.calls[0]?.[0] as {
      where: { id: { in: string[] } };
    };
    expect(deleteArg.where.id.in).toEqual(['ph1', 'ph2']);
  });

  it('crea un aggregate distinto por cada (externalId, source, día)', async () => {
    const rows = [
      {
        id: 'ph1',
        price: 50 as unknown,
        currency: 'COP' as const,
        recordedAt: daysAgo(100),
        trackedProduct: { externalId: 'MLA1', source: 'ML' as const },
      },
      {
        id: 'ph2',
        price: 60 as unknown,
        currency: 'USD' as const,
        recordedAt: daysAgo(100),
        trackedProduct: { externalId: 'AE1', source: 'ALIEXPRESS' as const },
      },
    ];
    prisma.priceHistory.findMany.mockResolvedValueOnce(rows);
    prisma.priceAggregate.upsert.mockResolvedValue({});
    prisma.priceHistory.deleteMany.mockResolvedValueOnce({ count: 2 });

    const summary = await cleanupOldPriceHistoryOnce({ prisma: asPrisma(prisma) });

    expect(summary.aggregated).toBe(2);
    expect(prisma.priceAggregate.upsert).toHaveBeenCalledTimes(2);
  });
});
