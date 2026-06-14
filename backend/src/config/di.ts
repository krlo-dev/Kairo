// Inyección de dependencias mínima — permite swap de implementaciones (v.1 ↔ v.2).

import { PrismaClient } from '@prisma/client';
import type { CacheService } from '../interfaces/CacheService.js';
import type { JobQueue } from '../interfaces/JobQueue.js';
import { LruCacheService } from '../implementations/LruCacheService.js';
import { MysqlJobQueue } from '../implementations/MysqlJobQueue.js';

export interface Container {
  prisma: PrismaClient;
  cache: CacheService;
  jobs: JobQueue;
}

let container: Container | null = null;

export function createContainer(): Container {
  if (container) return container;
  container = {
    prisma: new PrismaClient(),
    cache: new LruCacheService({ max: 5000, defaultTtlSeconds: 300 }),
    jobs: new MysqlJobQueue(),
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
