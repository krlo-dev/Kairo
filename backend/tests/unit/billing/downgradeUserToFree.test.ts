import { beforeEach, describe, expect, it } from 'vitest';
import { downgradeUserToFree } from '../../../src/services/billing/downgradeUserToFree.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { buildTrackedProduct } from '../../fixtures/trackedProductFactory.js';

describe('downgradeUserToFree', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('pone el plan en FREE y no toca nada si hay 3 o menos productos activos', async () => {
    prisma.user.update.mockResolvedValue({});
    prisma.trackedProduct.findMany.mockResolvedValue([
      buildTrackedProduct(),
      buildTrackedProduct(),
    ]);

    const result = await downgradeUserToFree(asPrisma(prisma), 'user-1');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { plan: 'FREE' },
    });
    expect(prisma.trackedProduct.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ deactivated: 0 });
  });

  it('conserva los 3 más recientes y desactiva el resto si hay más de 3', async () => {
    prisma.user.update.mockResolvedValue({});
    const products = [
      buildTrackedProduct({ id: 'p1' }),
      buildTrackedProduct({ id: 'p2' }),
      buildTrackedProduct({ id: 'p3' }),
      buildTrackedProduct({ id: 'p4' }),
      buildTrackedProduct({ id: 'p5' }),
    ];
    // findMany ya ordena por addedAt desc — el mock devuelve el orden tal cual.
    prisma.trackedProduct.findMany.mockResolvedValue(products);
    prisma.trackedProduct.updateMany.mockResolvedValue({ count: 2 });

    const result = await downgradeUserToFree(asPrisma(prisma), 'user-1');

    expect(prisma.trackedProduct.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p4', 'p5'] } },
      data: { isActive: false },
    });
    expect(result).toEqual({ deactivated: 2 });
  });
});
