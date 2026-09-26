import { beforeEach, describe, expect, it } from 'vitest';
import { addTrackedProduct } from '../../../src/services/tracking/addTrackedProduct.service.js';
import { AppError } from '../../../src/utils/errors.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { buildUser } from '../../fixtures/userFactory.js';
import { buildTrackedProduct } from '../../fixtures/trackedProductFactory.js';
import type { AddTrackingInput } from '../../../src/services/tracking/types.js';

function buildInput(overrides: Partial<AddTrackingInput> = {}): AddTrackingInput {
  return {
    externalId: 'MLA123456',
    source: 'ML',
    title: 'Producto de prueba',
    imageUrl: 'https://example.com/img.jpg',
    productUrl: 'https://example.com/p/123',
    currentPrice: 50000,
    currency: 'COP',
    country: 'CO',
    ...overrides,
  };
}

describe('addTrackedProduct', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('crea un nuevo tracking para plan FREE con lockedUntil ~30 días', async () => {
    const user = buildUser({ plan: 'FREE' });
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce(user);
    prisma.trackedProduct.findUnique.mockResolvedValueOnce(null);
    prisma.trackedProduct.count.mockResolvedValueOnce(0);
    const created = buildTrackedProduct({ userId: user.id });
    prisma.trackedProduct.create.mockResolvedValueOnce(created);

    const result = await addTrackedProduct({ prisma: asPrisma(prisma) }, user.id, buildInput());

    expect(result).toBe(created);
    expect(prisma.trackedProduct.create).toHaveBeenCalledOnce();
    const createArg = prisma.trackedProduct.create.mock.calls[0]?.[0] as {
      data: { lockedUntil: Date | null; userId: string; externalId: string };
    };
    expect(createArg.data.userId).toBe(user.id);
    expect(createArg.data.lockedUntil).toBeInstanceOf(Date);
    const deltaMs = createArg.data.lockedUntil!.getTime() - Date.now();
    expect(deltaMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(deltaMs).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000 + 5000);
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it('no bloquea (lockedUntil null) para plan PRO', async () => {
    const user = buildUser({ plan: 'PRO' });
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce(user);
    prisma.trackedProduct.findUnique.mockResolvedValueOnce(null);
    prisma.trackedProduct.count.mockResolvedValueOnce(0);
    prisma.trackedProduct.create.mockResolvedValueOnce(buildTrackedProduct({ userId: user.id }));

    await addTrackedProduct({ prisma: asPrisma(prisma) }, user.id, buildInput());

    const createArg = prisma.trackedProduct.create.mock.calls[0]?.[0] as {
      data: { lockedUntil: Date | null };
    };
    expect(createArg.data.lockedUntil).toBeNull();
  });

  it('rechaza fuente no permitida por el plan (FREE + ALIEXPRESS)', async () => {
    const user = buildUser({ plan: 'FREE' });
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce(user);

    await expect(
      addTrackedProduct(
        { prisma: asPrisma(prisma) },
        user.id,
        buildInput({ source: 'ALIEXPRESS' }),
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: 'source_not_allowed' });

    expect(prisma.trackedProduct.create).not.toHaveBeenCalled();
  });

  it('rechaza duplicado activo con 409', async () => {
    const user = buildUser({ plan: 'FREE' });
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce(user);
    prisma.trackedProduct.findUnique.mockResolvedValueOnce(
      buildTrackedProduct({ userId: user.id, isActive: true }),
    );

    await expect(
      addTrackedProduct({ prisma: asPrisma(prisma) }, user.id, buildInput()),
    ).rejects.toMatchObject({ statusCode: 409, code: 'already_tracked' });

    expect(prisma.trackedProduct.create).not.toHaveBeenCalled();
  });

  it('rechaza cuando se alcanza el límite del plan', async () => {
    const user = buildUser({ plan: 'FREE' });
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce(user);
    prisma.trackedProduct.findUnique.mockResolvedValueOnce(null);
    prisma.trackedProduct.count.mockResolvedValueOnce(3); // FREE.maxTrackedProducts = 3

    await expect(
      addTrackedProduct({ prisma: asPrisma(prisma) }, user.id, buildInput()),
    ).rejects.toMatchObject({ statusCode: 403, code: 'limit_reached' });

    expect(prisma.trackedProduct.create).not.toHaveBeenCalled();
  });

  it('reactiva una fila inactiva en vez de crear una nueva', async () => {
    const user = buildUser({ plan: 'FREE' });
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce(user);
    const existing = buildTrackedProduct({
      userId: user.id,
      isActive: false,
      lockedUntil: new Date('2020-01-01'),
    });
    prisma.trackedProduct.findUnique.mockResolvedValueOnce(existing);
    prisma.trackedProduct.count.mockResolvedValueOnce(0);
    prisma.trackedProduct.update.mockResolvedValueOnce({ ...existing, isActive: true });

    await addTrackedProduct({ prisma: asPrisma(prisma) }, user.id, buildInput());

    expect(prisma.trackedProduct.update).toHaveBeenCalledOnce();
    expect(prisma.trackedProduct.create).not.toHaveBeenCalled();
    const updateArg = prisma.trackedProduct.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { isActive: boolean; lockedUntil: Date | null };
    };
    expect(updateArg.where.id).toBe(existing.id);
    expect(updateArg.data.isActive).toBe(true);
    expect(updateArg.data.lockedUntil).toBeInstanceOf(Date);
  });

  it('lanza AppError', async () => {
    const user = buildUser({ plan: 'FREE' });
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce(user);
    prisma.trackedProduct.findUnique.mockResolvedValueOnce(
      buildTrackedProduct({ userId: user.id, isActive: true }),
    );

    await expect(
      addTrackedProduct({ prisma: asPrisma(prisma) }, user.id, buildInput()),
    ).rejects.toBeInstanceOf(AppError);
  });
});
