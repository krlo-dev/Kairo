import { beforeEach, describe, expect, it } from 'vitest';
import { listTrackedProducts } from '../../../src/services/tracking/listTrackedProducts.service.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { buildTrackedProduct } from '../../fixtures/trackedProductFactory.js';

describe('listTrackedProducts', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('pagina correctamente y solo trae isActive=true del usuario', async () => {
    const userId = 'user-1';
    const rows = [buildTrackedProduct({ userId }), buildTrackedProduct({ userId })];
    prisma.trackedProduct.findMany.mockResolvedValueOnce(rows);
    prisma.trackedProduct.count.mockResolvedValueOnce(2);

    const result = await listTrackedProducts({ prisma: asPrisma(prisma) }, userId, 1, 20);

    expect(result.data).toBe(rows);
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });

    const findManyArg = prisma.trackedProduct.findMany.mock.calls[0]?.[0] as {
      where: { userId: string; isActive: boolean };
      skip: number;
      take: number;
      orderBy: { addedAt: string };
    };
    expect(findManyArg.where).toEqual({ userId, isActive: true });
    expect(findManyArg.skip).toBe(0);
    expect(findManyArg.take).toBe(20);
    expect(findManyArg.orderBy).toEqual({ addedAt: 'desc' });
  });

  it('calcula el offset (skip) según la página pedida', async () => {
    prisma.trackedProduct.findMany.mockResolvedValueOnce([]);
    prisma.trackedProduct.count.mockResolvedValueOnce(0);

    await listTrackedProducts({ prisma: asPrisma(prisma) }, 'user-1', 3, 10);

    const findManyArg = prisma.trackedProduct.findMany.mock.calls[0]?.[0] as { skip: number };
    expect(findManyArg.skip).toBe(20); // (3-1) * 10
  });

  it('totalPages es al menos 1 aunque total sea 0', async () => {
    prisma.trackedProduct.findMany.mockResolvedValueOnce([]);
    prisma.trackedProduct.count.mockResolvedValueOnce(0);

    const result = await listTrackedProducts({ prisma: asPrisma(prisma) }, 'user-1', 1, 20);

    expect(result.pagination.totalPages).toBe(1);
    expect(result.pagination.total).toBe(0);
  });
});
