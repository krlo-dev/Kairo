import type { PrismaClient } from '@prisma/client';
import type { TrackingListResult } from './types.js';

export interface TrackingDeps {
  prisma: PrismaClient;
}

export async function listTrackedProducts(
  deps: TrackingDeps,
  userId: string,
  page: number,
  limit: number,
): Promise<TrackingListResult> {
  const where = { userId, isActive: true };
  const [data, total] = await Promise.all([
    deps.prisma.trackedProduct.findMany({
      where,
      orderBy: { addedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    deps.prisma.trackedProduct.count({ where }),
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
