import type { PrismaClient } from '@prisma/client';
import type { ScheduledTask } from 'node-cron';
import type { CacheService } from '../interfaces/CacheService.js';
import type { EmailService } from '../interfaces/EmailService.js';
import { MercadoLibreService } from '../services/mercadolibre/mercadolibre.service.js';
import { AliExpressService } from '../services/aliexpress/aliexpress.service.js';
import { startTokenRefreshJob } from './tokenRefresh.job.js';
import { startPricePollJob } from './pricePoll.job.js';
import { startCleanupJob } from './cleanup.job.js';
import { startAlertRetryJob } from './alertRetry.job.js';
import { startSubscriptionDowngradeJob } from './subscriptionDowngrade.job.js';

// Entrypoint único de node-cron — arranca todos los jobs programados de la
// app y devuelve sus handles para poder detenerlos en el shutdown.

export interface SchedulerDeps {
  prisma: PrismaClient;
  cache: CacheService;
  email: EmailService;
}

export interface SchedulerHandle {
  stopAll: () => void;
}

export function startScheduler(deps: SchedulerDeps): SchedulerHandle {
  const ml = new MercadoLibreService({ cache: deps.cache });
  const ae = new AliExpressService({ cache: deps.cache });

  const tasks: ScheduledTask[] = [
    startTokenRefreshJob({ prisma: deps.prisma }),
    startPricePollJob({ prisma: deps.prisma, ml, ae, email: deps.email }),
    startCleanupJob({ prisma: deps.prisma }),
    startAlertRetryJob({ prisma: deps.prisma, email: deps.email }),
    startSubscriptionDowngradeJob({ prisma: deps.prisma, email: deps.email }),
  ];

  return {
    stopAll: () => {
      for (const task of tasks) task.stop();
    },
  };
}
