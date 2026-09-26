import { beforeEach, describe, expect, it } from 'vitest';
import { checkAndFireAlerts } from '../../../src/services/alerts/checkAndFireAlerts.service.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { createEmailMock, asEmail, type EmailMock } from '../../helpers/emailMock.js';
import { buildTrackedProduct } from '../../fixtures/trackedProductFactory.js';
import { buildAlert } from '../../fixtures/alertFactory.js';
import { buildUser } from '../../fixtures/userFactory.js';

const RECORDED_AT = new Date('2026-09-26T12:00:00.000Z');

function daysAgo(d: number): Date {
  return new Date(RECORDED_AT.getTime() - d * 24 * 60 * 60 * 1000);
}

describe('checkAndFireAlerts', () => {
  let prisma: PrismaMock;
  let email: EmailMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    email = createEmailMock();
    prisma.alertNotification.count.mockResolvedValue(0);
    prisma.alertNotification.findUnique.mockResolvedValue(null);
  });

  function mockTrackedProductWithAlerts(alerts: ReturnType<typeof buildAlert>[]) {
    const user = buildUser();
    const tp = { ...buildTrackedProduct({ userId: user.id }), user, alerts };
    prisma.trackedProduct.findUnique.mockResolvedValueOnce(tp);
    return tp;
  }

  it('dispara una alerta DOWN cuando price <= targetPrice: notifica y marca triggered', async () => {
    const alert = buildAlert({ direction: 'DOWN', targetPrice: 90000, mode: 'ONE_SHOT' });
    mockTrackedProductWithAlerts([alert]);
    prisma.alertNotification.create.mockResolvedValueOnce({ id: 'an1' });

    const summary = await checkAndFireAlerts(
      { prisma: asPrisma(prisma), email: asEmail(email) },
      'tp-1',
      85000,
      RECORDED_AT,
    );

    expect(summary).toEqual({ evaluated: 1, fired: 1, rateLimited: 0 });
    expect(email.sendAlertTriggered).toHaveBeenCalledOnce();
    expect(prisma.alert.update).toHaveBeenCalledWith({
      where: { id: alert.id },
      data: { triggered: true, lastTriggeredAt: RECORDED_AT },
    });
    const updateArg = prisma.alertNotification.update.mock.calls[0]?.[0] as {
      data: { status: string };
    };
    expect(updateArg.data.status).toBe('SENT');
  });

  it('no dispara si la condición no se cumple', async () => {
    const alert = buildAlert({ direction: 'DOWN', targetPrice: 90000 });
    mockTrackedProductWithAlerts([alert]);

    const summary = await checkAndFireAlerts(
      { prisma: asPrisma(prisma), email: asEmail(email) },
      'tp-1',
      95000,
      RECORDED_AT,
    );

    expect(summary.fired).toBe(0);
    expect(email.sendAlertTriggered).not.toHaveBeenCalled();
    expect(prisma.alertNotification.create).not.toHaveBeenCalled();
  });

  it('una alerta ONE_SHOT ya disparada no vuelve a dispararse', async () => {
    const alert = buildAlert({ direction: 'DOWN', targetPrice: 90000, triggered: true });
    mockTrackedProductWithAlerts([alert]);

    const summary = await checkAndFireAlerts(
      { prisma: asPrisma(prisma), email: asEmail(email) },
      'tp-1',
      80000,
      RECORDED_AT,
    );

    expect(summary.fired).toBe(0);
  });

  it('RECURRING dentro del cooldown no vuelve a dispararse', async () => {
    const alert = buildAlert({
      direction: 'DOWN',
      targetPrice: 90000,
      mode: 'RECURRING',
      cooldownDays: 7,
      lastTriggeredAt: daysAgo(1),
    });
    mockTrackedProductWithAlerts([alert]);

    const summary = await checkAndFireAlerts(
      { prisma: asPrisma(prisma), email: asEmail(email) },
      'tp-1',
      80000,
      RECORDED_AT,
    );

    expect(summary.fired).toBe(0);
  });

  it('RECURRING con cooldown vencido vuelve a dispararse', async () => {
    const alert = buildAlert({
      direction: 'DOWN',
      targetPrice: 90000,
      mode: 'RECURRING',
      cooldownDays: 7,
      lastTriggeredAt: daysAgo(8),
    });
    mockTrackedProductWithAlerts([alert]);
    prisma.alertNotification.create.mockResolvedValueOnce({ id: 'an1' });

    const summary = await checkAndFireAlerts(
      { prisma: asPrisma(prisma), email: asEmail(email) },
      'tp-1',
      80000,
      RECORDED_AT,
    );

    expect(summary.fired).toBe(1);
    // RECURRING nunca se marca `triggered=true` de forma permanente.
    expect(prisma.alert.update).toHaveBeenCalledWith({
      where: { id: alert.id },
      data: { triggered: false, lastTriggeredAt: RECORDED_AT },
    });
  });

  it('direction PCT dispara en baja cuando el % cae por debajo del threshold negativo', async () => {
    const alert = buildAlert({
      direction: 'PCT',
      targetPrice: null,
      pctThreshold: -10,
      basePrice: 100000,
    });
    mockTrackedProductWithAlerts([alert]);
    prisma.alertNotification.create.mockResolvedValueOnce({ id: 'an1' });

    // (88000 - 100000) / 100000 * 100 = -12% <= -10%
    const summary = await checkAndFireAlerts(
      { prisma: asPrisma(prisma), email: asEmail(email) },
      'tp-1',
      88000,
      RECORDED_AT,
    );

    expect(summary.fired).toBe(1);
  });

  it('dedup: si ya existe un AlertNotification con ese idempotencyKey, no reprocesa', async () => {
    const alert = buildAlert({ direction: 'DOWN', targetPrice: 90000 });
    mockTrackedProductWithAlerts([alert]);
    prisma.alertNotification.findUnique.mockResolvedValueOnce({ id: 'existing' });

    const summary = await checkAndFireAlerts(
      { prisma: asPrisma(prisma), email: asEmail(email) },
      'tp-1',
      80000,
      RECORDED_AT,
    );

    expect(summary.fired).toBe(0);
    expect(prisma.alertNotification.create).not.toHaveBeenCalled();
    expect(email.sendAlertTriggered).not.toHaveBeenCalled();
  });

  it('rate limit: no dispara más de 10 notificaciones/hora por usuario', async () => {
    const alert = buildAlert({ direction: 'DOWN', targetPrice: 90000 });
    mockTrackedProductWithAlerts([alert]);
    prisma.alertNotification.count.mockResolvedValueOnce(10);

    const summary = await checkAndFireAlerts(
      { prisma: asPrisma(prisma), email: asEmail(email) },
      'tp-1',
      80000,
      RECORDED_AT,
    );

    expect(summary.fired).toBe(0);
    expect(summary.rateLimited).toBe(1);
    expect(prisma.alertNotification.create).not.toHaveBeenCalled();
  });

  it('si el envío de email falla, el AlertNotification queda PENDING con el error registrado', async () => {
    const alert = buildAlert({ direction: 'DOWN', targetPrice: 90000 });
    mockTrackedProductWithAlerts([alert]);
    prisma.alertNotification.create.mockResolvedValueOnce({ id: 'an1' });
    email.sendAlertTriggered.mockRejectedValueOnce(new Error('resend down'));

    const summary = await checkAndFireAlerts(
      { prisma: asPrisma(prisma), email: asEmail(email) },
      'tp-1',
      80000,
      RECORDED_AT,
    );

    expect(summary.fired).toBe(1); // se considera "disparada" aunque la entrega haya fallado
    const updateArg = prisma.alertNotification.update.mock.calls[0]?.[0] as {
      data: { status: string; errorMessage?: string };
    };
    expect(updateArg.data.status).toBe('PENDING');
    expect(updateArg.data.errorMessage).toContain('resend down');
  });

  it('sin trackedProduct no hace nada', async () => {
    prisma.trackedProduct.findUnique.mockResolvedValueOnce(null);

    const summary = await checkAndFireAlerts(
      { prisma: asPrisma(prisma), email: asEmail(email) },
      'tp-inexistente',
      80000,
      RECORDED_AT,
    );

    expect(summary).toEqual({ evaluated: 0, fired: 0, rateLimited: 0 });
  });
});
