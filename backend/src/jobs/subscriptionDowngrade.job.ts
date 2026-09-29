import type { PrismaClient } from '@prisma/client';
import cron, { type ScheduledTask } from 'node-cron';
import { logger } from '../logger/pino.js';
import type { EmailService } from '../interfaces/EmailService.js';
import { downgradeUserToFree } from '../services/billing/downgradeUserToFree.js';

// Job: aplica el downgrade a FREE cuando una Subscription tiene
// cancelAtPeriodEnd=true y ya venció currentPeriodEnd (SPEC §8.4 — "el
// downgrade aplica al fin del período actual, no inmediato"). Corre cada
// noche a las 3:30am (justo después de cleanup.job, sin pisarlo).

const SCHEDULE = '30 3 * * *';

export interface SubscriptionDowngradeDeps {
  prisma: PrismaClient;
  email: EmailService;
}

export interface SubscriptionDowngradeSummary {
  due: number;
  downgraded: number;
  failed: number;
}

export async function downgradeExpiredSubscriptionsOnce(
  deps: SubscriptionDowngradeDeps,
): Promise<SubscriptionDowngradeSummary> {
  const now = new Date();
  const due = await deps.prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { lte: now },
    },
    include: { user: true },
  });

  let downgraded = 0;
  let failed = 0;

  for (const subscription of due) {
    try {
      await deps.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: 'CANCELED', canceledAt: now },
        });
        await downgradeUserToFree(tx, subscription.userId);
      });

      await deps.email
        .sendPlanDowngraded({
          to: subscription.user.email,
          name: subscription.user.name,
          fromPlan: subscription.plan,
        })
        .catch((err: unknown) => logger.error({ err }, 'sendPlanDowngraded failed'));

      downgraded += 1;
    } catch (err) {
      failed += 1;
      logger.error({ err, subscriptionId: subscription.id }, 'subscription downgrade failed');
    }
  }

  logger.info({ due: due.length, downgraded, failed }, 'subscriptionDowngrade.job batch done');
  return { due: due.length, downgraded, failed };
}

export function startSubscriptionDowngradeJob(deps: SubscriptionDowngradeDeps): ScheduledTask {
  const task = cron.schedule(
    SCHEDULE,
    () => {
      downgradeExpiredSubscriptionsOnce(deps).catch((err: unknown) => {
        logger.error({ err }, 'subscriptionDowngrade.job unhandled error');
      });
    },
    { timezone: 'America/Bogota' },
  );
  logger.info({ schedule: SCHEDULE }, 'subscriptionDowngrade.job scheduled');
  return task;
}
