import { beforeEach, describe, expect, it } from 'vitest';
import { deleteAlert } from '../../../src/services/alerts/deleteAlert.service.js';
import { createPrismaMock, asPrisma, type PrismaMock } from '../../helpers/prismaMock.js';
import { buildAlert } from '../../fixtures/alertFactory.js';

describe('deleteAlert', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('hace soft delete (isActive=false) y deja auditoría', async () => {
    const alert = buildAlert();
    prisma.alert.update.mockResolvedValueOnce({ ...alert, isActive: false });

    await deleteAlert({ prisma: asPrisma(prisma) }, alert);

    expect(prisma.alert.update).toHaveBeenCalledWith({
      where: { id: alert.id },
      data: { isActive: false },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });
});
