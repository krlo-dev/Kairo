import type { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../logger/pino.js';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  resource?: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

// Audit logs son "fire-and-forget" desde el punto de vista del flujo de
// negocio: si la inserción falla, el request no debe romperse. Loguear el
// error y seguir.
export async function recordAudit(prisma: PrismaClient, entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        ...(entry.resource !== undefined ? { resource: entry.resource } : {}),
        ...(entry.resourceId !== undefined ? { resourceId: entry.resourceId } : {}),
        ...(entry.ip !== undefined ? { ip: entry.ip } : {}),
        ...(entry.userAgent !== undefined ? { userAgent: entry.userAgent } : {}),
        ...(entry.metadata !== undefined
          ? { metadata: entry.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });
  } catch (err) {
    logger.error({ err, action: entry.action }, 'audit log insert failed');
  }
}
