import type { PrismaClient } from '@prisma/client';
import cron, { type ScheduledTask } from 'node-cron';
import type { EmailService } from '../interfaces/EmailService.js';
import { logger } from '../logger/pino.js';

// Job: reintenta el envío de AlertNotification que quedaron en PENDING tras
// un fallo de Resend. SPEC §10 "Alertas — reintentos de delivery: 3 con
// backoff exponencial (1min, 5min, 30min). Tras fallo final → status=FAILED".
//
// attempts=1 es el intento inicial (síncrono, en checkAndFireAlerts).
// Este job hace los 3 reintentos siguientes: 2, 3 y 4. Corre cada minuto
// para no perder el primer backoff (1min).

const SCHEDULE = '* * * * *';
const MAX_ATTEMPTS = 4;
// Índice = attempts actual (1-based) → ms a esperar desde lastAttemptAt
// antes de intentar de nuevo.
const BACKOFF_MS: Record<number, number> = {
  1: 60_000,
  2: 5 * 60_000,
  3: 30 * 60_000,
};

export interface AlertRetryDeps {
  prisma: PrismaClient;
  email: EmailService;
}

export interface AlertRetrySummary {
  scanned: number;
  retried: number;
  sent: number;
  failed: number;
}

export async function retryFailedAlertsOnce(deps: AlertRetryDeps): Promise<AlertRetrySummary> {
  const pending = await deps.prisma.alertNotification.findMany({
    where: { status: 'PENDING', attempts: { lt: MAX_ATTEMPTS } },
    include: { alert: { include: { trackedProduct: true } }, user: true },
  });

  const now = Date.now();
  const due = pending.filter((n) => {
    const waitMs = BACKOFF_MS[n.attempts] ?? 0;
    const since = n.lastAttemptAt ? now - n.lastAttemptAt.getTime() : Number.POSITIVE_INFINITY;
    return since >= waitMs;
  });

  let sent = 0;
  let failed = 0;

  for (const notification of due) {
    const nextAttempt = notification.attempts + 1;
    try {
      await deps.email.sendAlertTriggered({
        to: notification.user.email,
        name: notification.user.name,
        productTitle: notification.alert.trackedProduct.title,
        productUrl: notification.alert.trackedProduct.productUrl,
        price: Number(notification.pricePaid),
        currency: notification.alert.trackedProduct.currency,
        targetPrice:
          notification.alert.targetPrice !== null ? Number(notification.alert.targetPrice) : null,
      });
      await deps.prisma.alertNotification.update({
        where: { id: notification.id },
        data: { status: 'SENT', attempts: nextAttempt, lastAttemptAt: new Date() },
      });
      sent += 1;
    } catch (err) {
      const isFinal = nextAttempt >= MAX_ATTEMPTS;
      await deps.prisma.alertNotification.update({
        where: { id: notification.id },
        data: {
          status: isFinal ? 'FAILED' : 'PENDING',
          attempts: nextAttempt,
          lastAttemptAt: new Date(),
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      failed += 1;
      logger.error(
        { err, notificationId: notification.id, final: isFinal },
        'alertRetry: intento de envío falló',
      );
    }
  }

  logger.info(
    { scanned: pending.length, retried: due.length, sent, failed },
    'alertRetry batch done',
  );
  return { scanned: pending.length, retried: due.length, sent, failed };
}

export function startAlertRetryJob(deps: AlertRetryDeps): ScheduledTask {
  const task = cron.schedule(
    SCHEDULE,
    () => {
      retryFailedAlertsOnce(deps).catch((err: unknown) => {
        logger.error({ err }, 'alertRetry.job unhandled error');
      });
    },
    { timezone: 'America/Bogota' },
  );
  logger.info({ schedule: SCHEDULE }, 'alertRetry.job scheduled');
  return task;
}
