import { beforeEach, describe, expect, it } from 'vitest';
import { removeTrackedProduct } from '../../../src/services/tracking/removeTrackedProduct.service.js';
import { AppError } from '../../../src/utils/errors.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { buildTrackedProduct } from '../../fixtures/trackedProductFactory.js';

describe('removeTrackedProduct', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('desactiva (isActive=false) un producto sin bloqueo vigente', async () => {
    const product = buildTrackedProduct({ lockedUntil: null });
    prisma.trackedProduct.update.mockResolvedValueOnce({ ...product, isActive: false });

    await removeTrackedProduct({ prisma: asPrisma(prisma) }, product);

    expect(prisma.trackedProduct.update).toHaveBeenCalledWith({
      where: { id: product.id },
      data: { isActive: false },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it('permite eliminar si el bloqueo ya expiró', async () => {
    const product = buildTrackedProduct({ lockedUntil: new Date('2020-01-01') });
    prisma.trackedProduct.update.mockResolvedValueOnce({ ...product, isActive: false });

    await removeTrackedProduct({ prisma: asPrisma(prisma) }, product);

    expect(prisma.trackedProduct.update).toHaveBeenCalledOnce();
  });

  it('rechaza con 403 product_locked si el bloqueo FREE sigue vigente', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const product = buildTrackedProduct({ lockedUntil });

    await expect(removeTrackedProduct({ prisma: asPrisma(prisma) }, product)).rejects.toMatchObject(
      { statusCode: 403, code: 'product_locked' },
    );

    expect(prisma.trackedProduct.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('lanza AppError al estar bloqueado', async () => {
    const product = buildTrackedProduct({
      lockedUntil: new Date(Date.now() + 60_000),
    });

    await expect(
      removeTrackedProduct({ prisma: asPrisma(prisma) }, product),
    ).rejects.toBeInstanceOf(AppError);
  });
});
