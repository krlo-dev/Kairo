// Factory de usuarios para tests. Devuelve un objeto con todos los campos
// del modelo Prisma User (incluidos id y timestamps) para que los services
// puedan tratarlo como si viniera de la DB.

import { randomBytes, randomUUID } from 'node:crypto';
import type { Plan, User } from '@prisma/client';

interface UserInput {
  id?: string;
  email?: string;
  name?: string;
  passwordHash?: string;
  plan?: Plan;
  emailVerified?: boolean;
  failedLoginAttempts?: number;
  accountLockedUntil?: Date | null;
  deletedAt?: Date | null;
}

export function buildUser(overrides: UserInput = {}): User {
  const suffix = randomBytes(4).toString('hex');
  const now = new Date();
  return {
    id: overrides.id ?? randomUUID(),
    email: overrides.email ?? `user-${suffix}@kairo.test`,
    passwordHash:
      overrides.passwordHash ?? '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.abc',
    name: overrides.name ?? `Test User ${suffix}`,
    phone: null,
    whatsappVerified: false,
    emailVerified: overrides.emailVerified ?? true,
    emailVerifiedAt: overrides.emailVerified === false ? null : now,
    lastLoginAt: null,
    failedLoginAttempts: overrides.failedLoginAttempts ?? 0,
    accountLockedUntil: overrides.accountLockedUntil ?? null,
    plan: overrides.plan ?? ('FREE' satisfies Plan),
    createdAt: now,
    updatedAt: now,
    deletedAt: overrides.deletedAt ?? null,
  };
}
