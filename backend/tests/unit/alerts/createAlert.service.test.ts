import { beforeEach, describe, expect, it } from 'vitest';
import { createAlert } from '../../../src/services/alerts/createAlert.service.js';
import { AppError } from '../../../src/utils/errors.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { buildTrackedProduct } from '../../fixtures/trackedProductFactory.js';
import { buildAlert } from '../../fixtures/alertFactory.js';
import type { CreateAlertInput } from '../../../src/services/alerts/types.js';

function buildInput(overrides: Partial<CreateAlertInput> = {}): CreateAlertInput {
  return {
    trackedProductId: 'tp-1',
    mode: 'ONE_SHOT',
    direction: 'DOWN',
    targetPrice: 90000,
    pctThreshold: null,
    cooldownDays: 7,
    notifyEmail: true,
    notifyWhatsapp: false,
    ...overrides,
  };
}

describe('createAlert', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('crea la alerta y fija basePrice = currentPrice del producto', async () => {
    const userId = 'user-1';
    const tp = buildTrackedProduct({ id: 'tp-1', userId, currentPrice: 100000 });
    prisma.trackedProduct.findUnique.mockResolvedValueOnce(tp);
    const created = buildAlert({ userId, trackedProductId: 'tp-1' });
    prisma.alert.create.mockResolvedValueOnce(created);

    const result = await createAlert({ prisma: asPrisma(prisma) }, userId, buildInput());

    expect(result).toBe(created);
    const createArg = prisma.alert.create.mock.calls[0]?.[0] as {
      data: { basePrice: unknown; notifyWhatsapp: boolean };
    };
    expect(createArg.data.basePrice).toBe(tp.currentPrice);
    expect(createArg.data.notifyWhatsapp).toBe(false);
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it('rechaza notifyWhatsapp=true con 400 (aún no disponible)', async () => {
    await expect(
      createAlert({ prisma: asPrisma(prisma) }, 'user-1', buildInput({ notifyWhatsapp: true })),
    ).rejects.toMatchObject({ statusCode: 400, code: 'whatsapp_not_available' });

    expect(prisma.trackedProduct.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza direction PCT sin pctThreshold', async () => {
    await expect(
      createAlert(
        { prisma: asPrisma(prisma) },
        'user-1',
        buildInput({ direction: 'PCT', targetPrice: null, pctThreshold: null }),
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rechaza direction DOWN/UP sin targetPrice', async () => {
    await expect(
      createAlert({ prisma: asPrisma(prisma) }, 'user-1', buildInput({ targetPrice: null })),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('devuelve 404 si el producto rastreado no existe o es de otro usuario', async () => {
    prisma.trackedProduct.findUnique.mockResolvedValueOnce(
      buildTrackedProduct({ id: 'tp-1', userId: 'otro-user' }),
    );

    await expect(
      createAlert({ prisma: asPrisma(prisma) }, 'user-1', buildInput()),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(prisma.alert.create).not.toHaveBeenCalled();
  });

  it('lanza AppError', async () => {
    await expect(
      createAlert({ prisma: asPrisma(prisma) }, 'user-1', buildInput({ notifyWhatsapp: true })),
    ).rejects.toBeInstanceOf(AppError);
  });
});
