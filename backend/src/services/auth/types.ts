import type { Plan, User } from '@prisma/client';

// Datos públicos de un user — nunca exponer passwordHash al cliente.
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  emailVerified: boolean;
  createdAt: string;
}

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    plan: u.plan,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt.toISOString(),
  };
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}
