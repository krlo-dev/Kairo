import type { PrismaClient, Source, TrackedProduct } from '@prisma/client';
import cron, { type ScheduledTask } from 'node-cron';
import { logger } from '../logger/pino.js';
import type { MercadoLibreService } from '../services/mercadolibre/mercadolibre.service.js';
import type { AliExpressService } from '../services/aliexpress/aliexpress.service.js';
import type { EmailService } from '../interfaces/EmailService.js';
import { checkAndFireAlerts } from '../services/alerts/checkAndFireAlerts.service.js';

// Job: refresca el precio de todos los productos rastreados activos.
// Schedule: cada hora en punto (`0 * * * *`). SPEC §10 "Polling".
//
// Reglas (SPEC §10):
// - Dedup por (externalId, source): si N usuarios rastrean el mismo
//   producto, 1 sola llamada upstream.
// - Priorización: alerta cerca del precio actual (±10%) → cada 1h;
//   con alerta pero lejos → cada 4h; sin alerta → cada 12h.
// - Solo se escribe PriceHistory si el precio difiere del último registrado.
// - Errores por producto NO detienen el batch.
// - Throttling: como el job corre cada hora, se procesa en lotes de
//   THROTTLE_BATCH_SIZE con una pausa entre lotes para no exceder ~60
//   req/min hacia cada fuente (configurable más adelante si hace falta).

const SCHEDULE = '0 * * * *';
const CLOSE_ALERT_PCT = 0.1;
const TIER_CLOSE_MS = 1 * 60 * 60 * 1000;
const TIER_FAR_MS = 4 * 60 * 60 * 1000;
const TIER_IDLE_MS = 12 * 60 * 60 * 1000;
const THROTTLE_BATCH_SIZE = 60;
const THROTTLE_DELAY_MS = 60_000;

export interface PricePollDeps {
  prisma: PrismaClient;
  ml: Pick<MercadoLibreService, 'getItem'>;
  ae: Pick<AliExpressService, 'getItem'>;
  email: EmailService;
}

interface GroupMember {
  trackedProduct: TrackedProduct;
  lastPrice: number;
  lastRecordedAt: Date;
}

interface Group {
  externalId: string;
  source: Source;
  members: GroupMember[];
}

export interface PricePollSummary {
  groups: number;
  due: number;
  polled: number;
  priceChanges: number;
  alertsFired: number;
  failed: number;
}

export async function pollPricesOnce(deps: PricePollDeps): Promise<PricePollSummary> {
  const products = await deps.prisma.trackedProduct.findMany({
    where: { isActive: true },
    include: { priceHistory: { orderBy: { recordedAt: 'desc' }, take: 1 } },
  });

  if (products.length === 0) {
    return { groups: 0, due: 0, polled: 0, priceChanges: 0, alertsFired: 0, failed: 0 };
  }

  const alerts = await deps.prisma.alert.findMany({
    where: {
      trackedProductId: { in: products.map((p) => p.id) },
      isActive: true,
      triggered: false,
    },
  });
  const alertsByProduct = new Map<string, typeof alerts>();
  for (const alert of alerts) {
    const list = alertsByProduct.get(alert.trackedProductId) ?? [];
    list.push(alert);
    alertsByProduct.set(alert.trackedProductId, list);
  }

  const groupsByKey = new Map<string, Group>();
  for (const tp of products) {
    const key = `${tp.source}:${tp.externalId}`;
    const lastEntry = tp.priceHistory[0];
    const member: GroupMember = {
      trackedProduct: tp,
      lastPrice: lastEntry ? Number(lastEntry.price) : Number(tp.currentPrice),
      lastRecordedAt: lastEntry ? lastEntry.recordedAt : tp.addedAt,
    };
    const existing = groupsByKey.get(key);
    if (existing) {
      existing.members.push(member);
    } else {
      groupsByKey.set(key, { externalId: tp.externalId, source: tp.source, members: [member] });
    }
  }

  const now = Date.now();
  const dueGroups: Group[] = [];
  for (const group of groupsByKey.values()) {
    const lastRecordedAt = Math.max(...group.members.map((m) => m.lastRecordedAt.getTime()));
    const hasCloseAlert = group.members.some((m) => {
      const productAlerts = alertsByProduct.get(m.trackedProduct.id) ?? [];
      return productAlerts.some((a) => {
        if (a.targetPrice === null) return false;
        const target = Number(a.targetPrice);
        if (target <= 0) return false;
        return Math.abs(m.lastPrice - target) / target <= CLOSE_ALERT_PCT;
      });
    });
    const hasAnyAlert = group.members.some(
      (m) => (alertsByProduct.get(m.trackedProduct.id) ?? []).length > 0,
    );
    const tierMs = hasCloseAlert ? TIER_CLOSE_MS : hasAnyAlert ? TIER_FAR_MS : TIER_IDLE_MS;
    if (now - lastRecordedAt >= tierMs) {
      dueGroups.push(group);
    }
  }

  let polled = 0;
  let priceChanges = 0;
  let alertsFired = 0;
  let failed = 0;

  for (let i = 0; i < dueGroups.length; i += THROTTLE_BATCH_SIZE) {
    const batch = dueGroups.slice(i, i + THROTTLE_BATCH_SIZE);
    for (const group of batch) {
      try {
        const country = group.members[0]?.trackedProduct.country ?? 'CO';
        const fresh =
          group.source === 'ML'
            ? await deps.ml.getItem(group.externalId)
            : await deps.ae.getItem(group.externalId, country);
        polled += 1;

        for (const member of group.members) {
          if (fresh.price === member.lastPrice) continue;
          const recordedAt = new Date();
          await deps.prisma.priceHistory.create({
            data: {
              trackedProductId: member.trackedProduct.id,
              userId: member.trackedProduct.userId,
              price: fresh.price,
              currency: fresh.currency,
              recordedAt,
            },
          });
          await deps.prisma.trackedProduct.update({
            where: { id: member.trackedProduct.id },
            data: { currentPrice: fresh.price },
          });
          priceChanges += 1;

          try {
            const alertSummary = await checkAndFireAlerts(
              { prisma: deps.prisma, email: deps.email },
              member.trackedProduct.id,
              fresh.price,
              recordedAt,
            );
            alertsFired += alertSummary.fired;
          } catch (alertErr) {
            logger.error(
              { err: alertErr, trackedProductId: member.trackedProduct.id },
              'pricePoll: checkAndFireAlerts falló, el precio ya quedó actualizado',
            );
          }
        }
      } catch (err) {
        failed += 1;
        logger.error(
          { err, externalId: group.externalId, source: group.source },
          'pricePoll: fallo consultando producto, sigue con el batch',
        );
      }
    }
    if (i + THROTTLE_BATCH_SIZE < dueGroups.length) {
      await sleep(THROTTLE_DELAY_MS);
    }
  }

  logger.info(
    { groups: groupsByKey.size, due: dueGroups.length, polled, priceChanges, alertsFired, failed },
    'pricePoll batch done',
  );
  return {
    groups: groupsByKey.size,
    due: dueGroups.length,
    polled,
    priceChanges,
    alertsFired,
    failed,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function startPricePollJob(deps: PricePollDeps): ScheduledTask {
  const task = cron.schedule(
    SCHEDULE,
    () => {
      pollPricesOnce(deps).catch((err: unknown) => {
        logger.error({ err }, 'pricePoll.job unhandled error');
      });
    },
    { timezone: 'America/Bogota' },
  );
  logger.info({ schedule: SCHEDULE }, 'pricePoll.job scheduled');
  return task;
}
