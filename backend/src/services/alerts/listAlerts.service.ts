import type { PrismaClient } from '@prisma/client';
import type { AlertListResult } from './types.js';

export interface AlertDeps {
  prisma: PrismaClient;
}

export async function listAlerts(
  deps: AlertDeps,
  userId: string,
  page: number,
  limit: number,
  trackedProductId?: string,
): Promise<AlertListResult> {
  const where = {
    userId,
    isActive: true,
    ...(trackedProductId ? { trackedProductId } : {}),
  };
  const [data, total] = await Promise.all([
    deps.prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    deps.prisma.alert.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
