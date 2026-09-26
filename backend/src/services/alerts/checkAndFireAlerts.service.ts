import type { Alert, PrismaClient } from '@prisma/client';
import type { EmailService } from '../../interfaces/EmailService.js';
import { logger } from '../../logger/pino.js';

// Motor de disparo de alertas — llamado desde pricePoll.job justo después
// de escribir un nuevo PriceHistory con precio distinto al anterior.
// SPEC §10 "Alertas".

const RATE_LIMIT_PER_HOUR = 10;

export interface CheckAlertsDeps {
  prisma: PrismaClient;
  email: EmailService;
}

export interface CheckAlertsSummary {
  evaluated: number;
  fired: number;
  rateLimited: number;
}

function isDue(alert: Alert, now: Date): boolean {
  if (alert.mode === 'ONE_SHOT') return !alert.triggered;
  // RECURRING: vuelve a estar disponible tras el cooldown desde el último disparo.
  if (!alert.lastTriggeredAt) return true;
  const cooldownMs = alert.cooldownDays * 24 * 60 * 60 * 1000;
  return now.getTime() - alert.lastTriggeredAt.getTime() >= cooldownMs;
}

function conditionMet(alert: Alert, price: number): boolean {
  if (alert.direction === 'DOWN') {
    return alert.targetPrice !== null && price <= Number(alert.targetPrice);
  }
  if (alert.direction === 'UP') {
    return alert.targetPrice !== null && price >= Number(alert.targetPrice);
  }
  // PCT: negativo = dispara en baja, positivo (o cero) = dispara en subida.
  if (alert.basePrice === null || alert.pctThreshold === null) return false;
  const base = Number(alert.basePrice);
  if (base <= 0) return false;
  const pct = ((price - base) / base) * 100;
  return alert.pctThreshold < 0 ? pct <= alert.pctThreshold : pct >= alert.pctThreshold;
}

export async function checkAndFireAlerts(
  deps: CheckAlertsDeps,
  trackedProductId: string,
  newPrice: number,
  recordedAt: Date,
): Promise<CheckAlertsSummary> {
  const trackedProduct = await deps.prisma.trackedProduct.findUnique({
    where: { id: trackedProductId },
    include: {
      user: true,
      alerts: { where: { isActive: true } },
    },
  });
  if (!trackedProduct) {
    return { evaluated: 0, fired: 0, rateLimited: 0 };
  }

  const candidates = trackedProduct.alerts.filter(
    (a) => isDue(a, recordedAt) && conditionMet(a, newPrice),
  );
  if (candidates.length === 0) {
    return { evaluated: trackedProduct.alerts.length, fired: 0, rateLimited: 0 };
  }

  const hourAgo = new Date(recordedAt.getTime() - 60 * 60 * 1000);
  const recentCount = await deps.prisma.alertNotification.count({
    where: { userId: trackedProduct.userId, createdAt: { gte: hourAgo } },
  });
  let budget = Math.max(0, RATE_LIMIT_PER_HOUR - recentCount);

  let fired = 0;
  let rateLimited = 0;

  for (const alert of candidates) {
    const idempotencyKey = `${alert.id}_${recordedAt.toISOString()}`;
    const existing = await deps.prisma.alertNotification.findUnique({
      where: { idempotencyKey },
    });
    if (existing) continue; // ya se procesó este mismo punto de precio.

    if (budget <= 0) {
      rateLimited += 1;
      logger.warn({ alertId: alert.id, userId: trackedProduct.userId }, 'alert rate-limited');
      continue;
    }

    await deps.prisma.alert.update({
      where: { id: alert.id },
      data: {
        triggered: alert.mode === 'ONE_SHOT' ? true : alert.triggered,
        lastTriggeredAt: recordedAt,
      },
    });

    const notification = await deps.prisma.alertNotification.create({
      data: {
        alertId: alert.id,
        userId: trackedProduct.userId,
        channel: 'EMAIL',
        idempotencyKey,
        status: 'PENDING',
        pricePaid: newPrice,
      },
    });

    try {
      await deps.email.sendAlertTriggered({
        to: trackedProduct.user.email,
        name: trackedProduct.user.name,
        productTitle: trackedProduct.title,
        productUrl: trackedProduct.productUrl,
        price: newPrice,
        currency: trackedProduct.currency,
        targetPrice: alert.targetPrice !== null ? Number(alert.targetPrice) : null,
      });
      await deps.prisma.alertNotification.update({
        where: { id: notification.id },
        data: { status: 'SENT', attempts: 1, lastAttemptAt: recordedAt },
      });
    } catch (err) {
      logger.error({ err, alertId: alert.id }, 'alert email send failed, queued for retry');
      await deps.prisma.alertNotification.update({
        where: { id: notification.id },
        data: {
          status: 'PENDING',
          attempts: 1,
          lastAttemptAt: recordedAt,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
    }

    budget -= 1;
    fired += 1;
  }

  return { evaluated: trackedProduct.alerts.length, fired, rateLimited };
}
