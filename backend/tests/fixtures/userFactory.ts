// Factory de usuarios para tests. Genera datos válidos sin tocar DB.
// Para crear en DB: pasar el resultado a prisma.user.create({ data: ... }).

import { randomBytes } from 'node:crypto';
import type { Plan } from '@prisma/client';

interface UserInput {
  email?: string;
  name?: string;
  passwordHash?: string;
  plan?: Plan;
  emailVerified?: boolean;
}

export function buildUser(overrides: UserInput = {}) {
  const suffix = randomBytes(4).toString('hex');
  return {
    email: overrides.email ?? `user-${suffix}@kairo.test`,
    name: overrides.name ?? `Test User ${suffix}`,
    passwordHash:
      overrides.passwordHash ??
      '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.abc',
    plan: overrides.plan ?? ('FREE' as Plan),
    emailVerified: overrides.emailVerified ?? true,
  };
}
