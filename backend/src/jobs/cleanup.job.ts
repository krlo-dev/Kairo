import type { Currency, PrismaClient, Source } from '@prisma/client';
import cron, { type ScheduledTask } from 'node-cron';
import { logger } from '../logger/pino.js';

// Job: archiva PriceHistory > 90 días en PriceAggregate (rollup diario) y
// borra los originales. Corre cada noche a las 3am. SPEC §10 "Polling".
// Tope MAX_ROWS_PER_RUN por corrida — si hay más pendientes, la siguiente
// corrida (24h después) sigue procesando el resto.

const SCHEDULE = '0 3 * * *';
const RETENTION_DAYS = 90;
const MAX_ROWS_PER_RUN = 5000;

export interface CleanupDeps {
  prisma: PrismaClient;
}

export interface CleanupSummary {
  scanned: number;
  aggregated: number;
  deleted: number;
}

interface Bucket {
  externalId: string;
  source: Source;
  day: Date;
  prices: number[];
  currency: Currency;
  lastRecordedAt: Date;
  lastPrice: number;
}

export async function cleanupOldPriceHistoryOnce(deps: CleanupDeps): Promise<CleanupSummary> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const rows = await deps.prisma.priceHistory.findMany({
    where: { recordedAt: { lt: cutoff } },
    include: { trackedProduct: { select: { externalId: true, source: true } } },
    take: MAX_ROWS_PER_RUN,
    orderBy: { recordedAt: 'asc' },
  });

  if (rows.length === 0) {
    return { scanned: 0, aggregated: 0, deleted: 0 };
  }

  const buckets = new Map<string, Bucket>();
  for (const row of rows) {
    const day = new Date(
      Date.UTC(
        row.recordedAt.getUTCFullYear(),
        row.recordedAt.getUTCMonth(),
        row.recordedAt.getUTCDate(),
      ),
    );
    const key = `${row.trackedProduct.source}:${row.trackedProduct.externalId}:${day.toISOString()}`;
    const price = Number(row.price);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.prices.push(price);
      if (row.recordedAt.getTime() >= bucket.lastRecordedAt.getTime()) {
        bucket.lastRecordedAt = row.recordedAt;
        bucket.lastPrice = price;
      }
    } else {
      buckets.set(key, {
        externalId: row.trackedProduct.externalId,
        source: row.trackedProduct.source,
        day,
        prices: [price],
        currency: row.currency,
        lastRecordedAt: row.recordedAt,
        lastPrice: price,
      });
    }
  }

  let aggregated = 0;
  for (const bucket of buckets.values()) {
    const min = Math.min(...bucket.prices);
    const max = Math.max(...bucket.prices);
    const avg = bucket.prices.reduce((a, b) => a + b, 0) / bucket.prices.length;

    await deps.prisma.priceAggregate.upsert({
      where: {
        externalId_source_day: {
          externalId: bucket.externalId,
          source: bucket.source,
          day: bucket.day,
        },
      },
      update: {
        minPrice: min,
        maxPrice: max,
        avgPrice: avg,
        closePrice: bucket.lastPrice,
        samples: bucket.prices.length,
        currency: bucket.currency,
      },
      create: {
        externalId: bucket.externalId,
        source: bucket.source,
        day: bucket.day,
        minPrice: min,
        maxPrice: max,
        avgPrice: avg,
        closePrice: bucket.lastPrice,
        samples: bucket.prices.length,
        currency: bucket.currency,
      },
    });
    aggregated += 1;
  }

  const ids = rows.map((r) => r.id);
  const { count: deleted } = await deps.prisma.priceHistory.deleteMany({
    where: { id: { in: ids } },
  });

  logger.info({ scanned: rows.length, aggregated, deleted }, 'cleanup.job batch done');
  return { scanned: rows.length, aggregated, deleted };
}

export function startCleanupJob(deps: CleanupDeps): ScheduledTask {
  const task = cron.schedule(
    SCHEDULE,
    () => {
      cleanupOldPriceHistoryOnce(deps).catch((err: unknown) => {
        logger.error({ err }, 'cleanup.job unhandled error');
      });
    },
    { timezone: 'America/Bogota' },
  );
  logger.info({ schedule: SCHEDULE }, 'cleanup.job scheduled');
  return task;
}
