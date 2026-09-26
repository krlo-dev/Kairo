import { beforeEach, describe, expect, it } from 'vitest';
import { retryFailedAlertsOnce } from '../../../src/jobs/alertRetry.job.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { createEmailMock, asEmail, type EmailMock } from '../../helpers/emailMock.js';
import { buildTrackedProduct } from '../../fixtures/trackedProductFactory.js';
import { buildAlert } from '../../fixtures/alertFactory.js';
import { buildUser } from '../../fixtures/userFactory.js';

function minutesAgo(m: number): Date {
  return new Date(Date.now() - m * 60_000);
}

function buildNotification(overrides: {
  id?: string;
  attempts?: number;
  lastAttemptAt?: Date | null;
  status?: 'PENDING';
}) {
  const alert = buildAlert();
  const trackedProduct = buildTrackedProduct();
  const user = buildUser();
  return {
    id: overrides.id ?? 'an-1',
    attempts: overrides.attempts ?? 1,
    lastAttemptAt: overrides.lastAttemptAt ?? minutesAgo(2),
    status: overrides.status ?? 'PENDING',
    pricePaid: 80000 as unknown,
    alert: { ...alert, trackedProduct },
    user,
  };
}

describe('retryFailedAlertsOnce', () => {
  let prisma: PrismaMock;
  let email: EmailMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    email = createEmailMock();
  });

  it('reintenta una notificación cuyo backoff ya se cumplió y la marca SENT', async () => {
    const n = buildNotification({ attempts: 1, lastAttemptAt: minutesAgo(2) }); // backoff attempts=1 es 1min
    prisma.alertNotification.findMany.mockResolvedValueOnce([n]);

    const summary = await retryFailedAlertsOnce({
      prisma: asPrisma(prisma),
      email: asEmail(email),
    });

    expect(summary).toEqual({ scanned: 1, retried: 1, sent: 1, failed: 0 });
    expect(email.sendAlertTriggered).toHaveBeenCalledOnce();
    const arg = prisma.alertNotification.update.mock.calls[0]?.[0] as {
      data: { status: string; attempts: number };
    };
    expect(arg.data.status).toBe('SENT');
    expect(arg.data.attempts).toBe(2);
  });

  it('no reintenta si todavía no se cumple el backoff', async () => {
    const n = buildNotification({ attempts: 1, lastAttemptAt: minutesAgo(0.1) }); // <1min
    prisma.alertNotification.findMany.mockResolvedValueOnce([n]);

    const summary = await retryFailedAlertsOnce({
      prisma: asPrisma(prisma),
      email: asEmail(email),
    });

    expect(summary).toEqual({ scanned: 1, retried: 0, sent: 0, failed: 0 });
    expect(email.sendAlertTriggered).not.toHaveBeenCalled();
  });

  it('marca FAILED cuando el intento final también falla', async () => {
    const n = buildNotification({ attempts: 3, lastAttemptAt: minutesAgo(31) }); // backoff attempts=3 es 30min
    prisma.alertNotification.findMany.mockResolvedValueOnce([n]);
    email.sendAlertTriggered.mockRejectedValueOnce(new Error('resend down'));

    const summary = await retryFailedAlertsOnce({
      prisma: asPrisma(prisma),
      email: asEmail(email),
    });

    expect(summary).toEqual({ scanned: 1, retried: 1, sent: 0, failed: 1 });
    const arg = prisma.alertNotification.update.mock.calls[0]?.[0] as {
      data: { status: string; attempts: number };
    };
    expect(arg.data.status).toBe('FAILED');
    expect(arg.data.attempts).toBe(4);
  });

  it('si falla pero no es el intento final, queda PENDING para el siguiente ciclo', async () => {
    const n = buildNotification({ attempts: 1, lastAttemptAt: minutesAgo(2) });
    prisma.alertNotification.findMany.mockResolvedValueOnce([n]);
    email.sendAlertTriggered.mockRejectedValueOnce(new Error('resend down'));

    const summary = await retryFailedAlertsOnce({
      prisma: asPrisma(prisma),
      email: asEmail(email),
    });

    expect(summary.failed).toBe(1);
    const arg = prisma.alertNotification.update.mock.calls[0]?.[0] as {
      data: { status: string; attempts: number };
    };
    expect(arg.data.status).toBe('PENDING');
    expect(arg.data.attempts).toBe(2);
  });

  it('sin notificaciones pendientes no hace nada', async () => {
    prisma.alertNotification.findMany.mockResolvedValueOnce([]);

    const summary = await retryFailedAlertsOnce({
      prisma: asPrisma(prisma),
      email: asEmail(email),
    });

    expect(summary).toEqual({ scanned: 0, retried: 0, sent: 0, failed: 0 });
  });
});
