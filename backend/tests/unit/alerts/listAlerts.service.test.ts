import { beforeEach, describe, expect, it } from 'vitest';
import { listAlerts } from '../../../src/services/alerts/listAlerts.service.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { buildAlert } from '../../fixtures/alertFactory.js';

describe('listAlerts', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('pagina y filtra solo isActive=true del usuario', async () => {
    const userId = 'user-1';
    const rows = [buildAlert({ userId }), buildAlert({ userId })];
    prisma.alert.findMany.mockResolvedValueOnce(rows);
    prisma.alert.count.mockResolvedValueOnce(2);

    const result = await listAlerts({ prisma: asPrisma(prisma) }, userId, 1, 20);

    expect(result.data).toBe(rows);
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
    const arg = prisma.alert.findMany.mock.calls[0]?.[0] as {
      where: { userId: string; isActive: boolean; trackedProductId?: string };
    };
    expect(arg.where).toEqual({ userId, isActive: true });
  });

  it('filtra por trackedProductId cuando se pasa', async () => {
    prisma.alert.findMany.mockResolvedValueOnce([]);
    prisma.alert.count.mockResolvedValueOnce(0);

    await listAlerts({ prisma: asPrisma(prisma) }, 'user-1', 1, 20, 'tp-1');

    const arg = prisma.alert.findMany.mock.calls[0]?.[0] as {
      where: { trackedProductId?: string };
    };
    expect(arg.where.trackedProductId).toBe('tp-1');
  });
});
