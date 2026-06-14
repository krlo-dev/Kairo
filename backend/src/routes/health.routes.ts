import { Router, type RequestHandler } from 'express';
import { getContainer } from '../config/di.js';
import { env } from '../config/env.js';

export const healthRouter = Router();

const healthHandler: RequestHandler = async (_req, res) => {
  const { prisma } = getContainer();
  const checks: Record<string, 'ok' | 'fail'> = { api: 'ok' };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'fail';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    env: env.NODE_ENV,
    version: '0.1.0',
    checks,
    timestamp: new Date().toISOString(),
  });
};

healthRouter.get('/health', healthHandler);
