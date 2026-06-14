// Stub mínimo de cola de jobs respaldada por la tabla `Job` en MySQL.
// Implementación completa en Fase 4 (polling + workers).

import type {
  JobHandler,
  JobPayload,
  JobQueue,
} from '../interfaces/JobQueue.js';
import { logger } from '../logger/pino.js';

export class MysqlJobQueue implements JobQueue {
  private handlers = new Map<string, JobHandler>();
  private running = false;

  enqueue<T extends Record<string, unknown>>(job: JobPayload<T>): Promise<string> {
    // TODO Fase 4: insertar en tabla Job con prisma.
    logger.debug({ job }, '[queue] enqueue stub');
    return Promise.resolve('stub-job-id');
  }

  register<T extends Record<string, unknown>>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler);
  }

  start(): Promise<void> {
    if (this.running) return Promise.resolve();
    this.running = true;
    logger.info('[queue] MysqlJobQueue iniciado (stub)');
    return Promise.resolve();
  }

  stop(): Promise<void> {
    this.running = false;
    logger.info('[queue] MysqlJobQueue detenido');
    return Promise.resolve();
  }
}
