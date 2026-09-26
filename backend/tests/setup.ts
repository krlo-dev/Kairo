// Test setup — establece envs mínimos para que `env.ts` parse en tests.
// Cada test que necesite DB real debe sobreescribir DATABASE_URL.

import { randomBytes } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '0';
process.env.APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'mysql://test:test@localhost:3306/kairo_test';

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? randomBytes(48).toString('hex');
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? randomBytes(48).toString('hex');
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? randomBytes(32).toString('hex');
process.env.CSRF_SECRET = process.env.CSRF_SECRET ?? randomBytes(32).toString('hex');
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
