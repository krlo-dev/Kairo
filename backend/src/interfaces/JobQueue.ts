// Abstracción de cola de jobs para permitir swap MySQL (v.1) → BullMQ (v.2)
// sin tocar la lógica de negocio.

export interface JobPayload<T = Record<string, unknown>> {
  type: string;
  data: T;
  priority?: number;
  scheduledAt?: Date;
  maxAttempts?: number;
}

export interface JobHandler<T = Record<string, unknown>> {
  (data: T): Promise<void>;
}

export interface JobQueue {
  enqueue<T extends Record<string, unknown>>(job: JobPayload<T>): Promise<string>;
  register<T extends Record<string, unknown>>(type: string, handler: JobHandler<T>): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}
