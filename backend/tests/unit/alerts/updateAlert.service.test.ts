import { beforeEach, describe, expect, it } from 'vitest';
import { updateAlert } from '../../../src/services/alerts/updateAlert.service.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { buildAlert } from '../../fixtures/alertFactory.js';

describe('updateAlert', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('actualiza campos parciales sin resetear el estado si la condición no cambió', async () => {
    const alert = buildAlert({ triggered: true, lastTriggeredAt: new Date('2026-01-01') });
    prisma.alert.update.mockResolvedValueOnce({ ...alert, notifyEmail: false });

    await updateAlert({ prisma: asPrisma(prisma) }, alert, { notifyEmail: false });

    const arg = prisma.alert.update.mock.calls[0]?.[0] as {
      data: { notifyEmail?: boolean; triggered?: boolean; lastTriggeredAt?: Date | null };
    };
    expect(arg.data.notifyEmail).toBe(false);
    expect(arg.data.triggered).toBeUndefined();
    expect(arg.data.lastTriggeredAt).toBeUndefined();
  });

  it('resetea triggered/lastTriggeredAt si cambia targetPrice', async () => {
    const alert = buildAlert({ triggered: true, targetPrice: 90000 as unknown as number });
    prisma.alert.update.mockResolvedValueOnce(alert);

    await updateAlert({ prisma: asPrisma(prisma) }, alert, { targetPrice: 80000 });

    const arg = prisma.alert.update.mock.calls[0]?.[0] as {
      data: { triggered?: boolean; lastTriggeredAt?: Date | null };
    };
    expect(arg.data.triggered).toBe(false);
    expect(arg.data.lastTriggeredAt).toBeNull();
  });

  it('rechaza notifyWhatsapp=true', async () => {
    const alert = buildAlert();

    await expect(
      updateAlert({ prisma: asPrisma(prisma) }, alert, { notifyWhatsapp: true }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'whatsapp_not_available' });

    expect(prisma.alert.update).not.toHaveBeenCalled();
  });

  it('rechaza si direction pasa a PCT sin pctThreshold (ni el existente ni uno nuevo)', async () => {
    const alert = buildAlert({ direction: 'DOWN', pctThreshold: null });

    await expect(
      updateAlert({ prisma: asPrisma(prisma) }, alert, { direction: 'PCT' }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('permite pausar la alerta con isActive=false', async () => {
    const alert = buildAlert({ isActive: true });
    prisma.alert.update.mockResolvedValueOnce({ ...alert, isActive: false });

    await updateAlert({ prisma: asPrisma(prisma) }, alert, { isActive: false });

    const arg = prisma.alert.update.mock.calls[0]?.[0] as { data: { isActive?: boolean } };
    expect(arg.data.isActive).toBe(false);
  });
});
