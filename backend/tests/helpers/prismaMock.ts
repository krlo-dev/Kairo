import { vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

// Mock parcial de PrismaClient cubriendo las llamadas que hacen los
// servicios de auth y tracking. No imita transacciones reales:
// `$transaction(fn)` invoca `fn(prismaMock)` directamente, así los tests
// pueden inspeccionar los métodos. Para `$transaction(promises[])` también
// se resuelve en paralelo. No es una DB en memoria — los tests deben
// configurar return values explícitamente con mockResolvedValueOnce.

export type PrismaMock = ReturnType<typeof createPrismaMock>;

export function createPrismaMock() {
  const mock = {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    emailVerification: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    trackedProduct: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    priceHistory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    priceAggregate: {
      upsert: vi.fn(),
    },
    alert: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    alertNotification: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  // Por defecto, $transaction(callback) corre callback(mock); con array,
  // resuelve los promises tal cual.
  mock.$transaction.mockImplementation((arg: unknown) => {
    if (typeof arg === 'function') {
      const fn = arg as (tx: typeof mock) => Promise<unknown>;
      return fn(mock);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg as Promise<unknown>[]);
    }
    return Promise.resolve(undefined);
  });

  return mock;
}

export function asPrisma(mock: PrismaMock): PrismaClient {
  return mock as unknown as PrismaClient;
}
