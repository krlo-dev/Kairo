// Inyección de dependencias mínima — permite swap de implementaciones (v.1 ↔ v.2).

import { PrismaClient } from '@prisma/client';
import type { CacheService } from '../interfaces/CacheService.js';
import type { EmailService } from '../interfaces/EmailService.js';
import type { JobQueue } from '../interfaces/JobQueue.js';
import { LruCacheService } from '../implementations/LruCacheService.js';
import { MysqlJobQueue } from '../implementations/MysqlJobQueue.js';
import { ConsoleEmailService } from '../implementations/ConsoleEmailService.js';
import { ResendEmailService } from '../implementations/ResendEmailService.js';
import { env } from './env.js';

export interface Container {
  prisma: PrismaClient;
  cache: CacheService;
  jobs: JobQueue;
  email: EmailService;
}

let container: Container | null = null;

export function createContainer(overrides: Partial<Container> = {}): Container {
  if (container) return container;
  container = {
    prisma: overrides.prisma ?? new PrismaClient(),
    cache: overrides.cache ?? new LruCacheService({ max: 5000, defaultTtlSeconds: 300 }),
    jobs: overrides.jobs ?? new MysqlJobQueue(),
    email:
      overrides.email ??
      (env.RESEND_API_KEY ? new ResendEmailService() : new ConsoleEmailService()),
  };
  return container;
}

export function getContainer(): Container {
  if (!container) {
    throw new Error('Container not initialized — call createContainer() first.');
  }
  return container;
}

export async function disposeContainer(): Promise<void> {
  if (!container) return;
  await container.jobs.stop();
  await container.prisma.$disconnect();
  container = null;
}
