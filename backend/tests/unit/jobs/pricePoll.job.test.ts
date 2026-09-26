import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pollPricesOnce } from '../../../src/jobs/pricePoll.job.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { createEmailMock, asEmail, type EmailMock } from '../../helpers/emailMock.js';
import { buildTrackedProduct } from '../../fixtures/trackedProductFactory.js';

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function makeMl(price = 100) {
  return {
    getItem: vi.fn().mockResolvedValue({
      externalId: 'MLA1',
      source: 'ML',
      title: 'Producto',
      imageUrl: null,
      productUrl: 'https://x/1',
      price,
      currency: 'COP',
      country: 'CO',
    }),
  };
}

function makeAe(price = 10) {
  return {
    getItem: vi.fn().mockResolvedValue({
      externalId: 'AE1',
      source: 'ALIEXPRESS',
      title: 'Producto AE',
      imageUrl: null,
      productUrl: 'https://x/2',
      price,
      currency: 'USD',
      country: 'CO',
    }),
  };
}

describe('pollPricesOnce', () => {
  let prisma: PrismaMock;
  let email: EmailMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.alert.findMany.mockResolvedValue([]);
    email = createEmailMock();
  });

  it('sin productos activos no hace nada', async () => {
    prisma.trackedProduct.findMany.mockResolvedValueOnce([]);
    const ml = makeMl();
    const ae = makeAe();

    const summary = await pollPricesOnce({
      prisma: asPrisma(prisma),
      ml,
      ae,
      email: asEmail(email),
    });

    expect(summary).toEqual({
      groups: 0,
      due: 0,
      polled: 0,
      priceChanges: 0,
      failed: 0,
      alertsFired: 0,
    });
    expect(ml.getItem).not.toHaveBeenCalled();
  });

  it('deduplica: 2 usuarios rastreando el mismo producto → 1 sola llamada upstream', async () => {
    const tp1 = { ...buildTrackedProduct({ externalId: 'MLA1', source: 'ML' }), priceHistory: [] };
    const tp2 = { ...buildTrackedProduct({ externalId: 'MLA1', source: 'ML' }), priceHistory: [] };
    // Sin historial: usa addedAt (más de 12h atrás) como último registro, y
    // sin alertas cae en el tier IDLE (12h) → debe quedar "due".
    tp1.addedAt = hoursAgo(13);
    tp2.addedAt = hoursAgo(13);
    tp1.currentPrice = 90000 as unknown as typeof tp1.currentPrice;
    tp2.currentPrice = 90000 as unknown as typeof tp2.currentPrice;
    prisma.trackedProduct.findMany.mockResolvedValueOnce([tp1, tp2]);

    const ml = makeMl(85000);
    const ae = makeAe();

    const summary = await pollPricesOnce({
      prisma: asPrisma(prisma),
      ml,
      ae,
      email: asEmail(email),
    });

    expect(ml.getItem).toHaveBeenCalledOnce();
    expect(summary.groups).toBe(1);
    expect(summary.due).toBe(1);
    expect(summary.polled).toBe(1);
    expect(summary.priceChanges).toBe(2); // ambos usuarios registran el cambio
    expect(prisma.priceHistory.create).toHaveBeenCalledTimes(2);
    expect(prisma.trackedProduct.update).toHaveBeenCalledTimes(2);
  });

  it('no escribe PriceHistory si el precio no cambió', async () => {
    const tp = { ...buildTrackedProduct({ externalId: 'MLA1', source: 'ML' }), priceHistory: [] };
    tp.addedAt = hoursAgo(13);
    tp.currentPrice = 100 as unknown as typeof tp.currentPrice;
    prisma.trackedProduct.findMany.mockResolvedValueOnce([tp]);

    const ml = makeMl(100); // mismo precio
    const ae = makeAe();

    const summary = await pollPricesOnce({
      prisma: asPrisma(prisma),
      ml,
      ae,
      email: asEmail(email),
    });

    expect(summary.priceChanges).toBe(0);
    expect(prisma.priceHistory.create).not.toHaveBeenCalled();
    expect(prisma.trackedProduct.update).not.toHaveBeenCalled();
  });

  it('no consulta un producto que aún no está "due" (sin alerta, <12h)', async () => {
    const tp = { ...buildTrackedProduct({ externalId: 'MLA1', source: 'ML' }), priceHistory: [] };
    tp.addedAt = hoursAgo(2); // recién agregado, sin alerta → tier 12h, no due
    prisma.trackedProduct.findMany.mockResolvedValueOnce([tp]);

    const ml = makeMl();
    const ae = makeAe();

    const summary = await pollPricesOnce({
      prisma: asPrisma(prisma),
      ml,
      ae,
      email: asEmail(email),
    });

    expect(summary.due).toBe(0);
    expect(ml.getItem).not.toHaveBeenCalled();
  });

  it('sí consulta un producto con alerta cerca del precio aunque hayan pasado <12h (tier 1h)', async () => {
    const tp = { ...buildTrackedProduct({ externalId: 'MLA1', source: 'ML' }), priceHistory: [] };
    tp.addedAt = hoursAgo(2);
    tp.currentPrice = 100000 as unknown as typeof tp.currentPrice;
    prisma.trackedProduct.findMany.mockResolvedValueOnce([tp]);
    prisma.alert.findMany.mockResolvedValueOnce([
      {
        id: 'a1',
        trackedProductId: tp.id,
        targetPrice: 95000 as unknown, // dentro del ±10% de 100000
        isActive: true,
        triggered: false,
      },
    ]);

    const ml = makeMl(95000);
    const ae = makeAe();

    const summary = await pollPricesOnce({
      prisma: asPrisma(prisma),
      ml,
      ae,
      email: asEmail(email),
    });

    expect(summary.due).toBe(1);
    expect(ml.getItem).toHaveBeenCalledOnce();
  });

  it('un error en un producto no detiene el resto del batch', async () => {
    const tpOk = { ...buildTrackedProduct({ externalId: 'MLA1', source: 'ML' }), priceHistory: [] };
    const tpFail = {
      ...buildTrackedProduct({ externalId: 'AE1', source: 'ALIEXPRESS' }),
      priceHistory: [],
    };
    tpOk.addedAt = hoursAgo(13);
    tpFail.addedAt = hoursAgo(13);
    prisma.trackedProduct.findMany.mockResolvedValueOnce([tpOk, tpFail]);

    const ml = makeMl(1);
    const ae = { getItem: vi.fn().mockRejectedValue(new Error('upstream boom')) };

    const summary = await pollPricesOnce({
      prisma: asPrisma(prisma),
      ml,
      ae,
      email: asEmail(email),
    });

    expect(summary.failed).toBe(1);
    expect(summary.polled).toBe(1); // el de ML sí se completó
  });
});
