import type { Alert, PrismaClient } from '@prisma/client';
import { recordAudit } from '../../utils/auditLog.js';

export interface AlertDeps {
  prisma: PrismaClient;
}

// Soft delete (isActive=false), igual que TrackedProduct — conserva el
// historial de AlertNotification en vez de perderlo con un delete real.
export async function deleteAlert(deps: AlertDeps, alert: Alert): Promise<void> {
  await deps.prisma.alert.update({
    where: { id: alert.id },
    data: { isActive: false },
  });

  await recordAudit(deps.prisma, {
    userId: alert.userId,
    action: 'alert_delete',
    resource: 'alert',
    resourceId: alert.id,
  });
}
