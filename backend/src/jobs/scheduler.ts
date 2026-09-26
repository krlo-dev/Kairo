import type { PrismaClient } from '@prisma/client';
import type { ScheduledTask } from 'node-cron';
import type { CacheService } from '../interfaces/CacheService.js';
import { MercadoLibreService } from '../services/mercadolibre/mercadolibre.service.js';
import { AliExpressService } from '../services/aliexpress/aliexpress.service.js';
import { startTokenRefreshJob } from './tokenRefresh.job.js';
import { startPricePollJob } from './pricePoll.job.js';
import { startCleanupJob } from './cleanup.job.js';

// Entrypoint único de node-cron — arranca todos los jobs programados de la
// app y devuelve sus handles para poder detenerlos en el shutdown.

export interface SchedulerDeps {
  prisma: PrismaClient;
  cache: CacheService;
}

export interface SchedulerHandle {
  stopAll: () => void;
}

export function startScheduler(deps: SchedulerDeps): SchedulerHandle {
  const ml = new MercadoLibreService({ cache: deps.cache });
  const ae = new AliExpressService({ cache: deps.cache });

  const tasks: ScheduledTask[] = [
    startTokenRefreshJob({ prisma: deps.prisma }),
    startPricePollJob({ prisma: deps.prisma, ml, ae }),
    startCleanupJob({ prisma: deps.prisma }),
  ];

  return {
    stopAll: () => {
      for (const task of tasks) task.stop();
    },
  };
}
