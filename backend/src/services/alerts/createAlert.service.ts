import type { Alert, PrismaClient } from '@prisma/client';
import { AppError, Errors } from '../../utils/errors.js';
import { recordAudit } from '../../utils/auditLog.js';
import type { CreateAlertInput } from './types.js';

export interface AlertDeps {
  prisma: PrismaClient;
}

export async function createAlert(
  deps: AlertDeps,
  userId: string,
  input: CreateAlertInput,
): Promise<Alert> {
  // WhatsApp aún no existe en este v0 (SPEC lo deja fuera de alcance) — se
  // rechaza explícito en vez de guardarlo en silencio como si fuera a llegar.
  if (input.notifyWhatsapp) {
    throw new AppError(
      'whatsapp_not_available',
      400,
      'Las notificaciones por WhatsApp todavía no están disponibles en Kairo.',
    );
  }

  if (input.direction === 'PCT' && input.pctThreshold === null) {
    throw Errors.validation('direction PCT requiere pctThreshold.');
  }
  if (input.direction !== 'PCT' && input.targetPrice === null) {
    throw Errors.validation('direction DOWN/UP requiere targetPrice.');
  }

  // 404 (no 403) si el producto no existe o es de otro usuario — mismo
  // criterio que ownership.middleware, para no filtrar existencia.
  const trackedProduct = await deps.prisma.trackedProduct.findUnique({
    where: { id: input.trackedProductId },
  });
  if (!trackedProduct || trackedProduct.userId !== userId || !trackedProduct.isActive) {
    throw Errors.notFound('Producto rastreado no encontrado');
  }

  const alert = await deps.prisma.alert.create({
    data: {
      userId,
      trackedProductId: input.trackedProductId,
      mode: input.mode,
      direction: input.direction,
      targetPrice: input.targetPrice,
      pctThreshold: input.pctThreshold,
      // basePrice se fija al crear la alerta — es el ancla para direction=PCT.
      basePrice: trackedProduct.currentPrice,
      cooldownDays: input.cooldownDays,
      notifyEmail: input.notifyEmail,
      notifyWhatsapp: false,
    },
  });

  await recordAudit(deps.prisma, {
    userId,
    action: 'alert_create',
    resource: 'alert',
    resourceId: alert.id,
  });

  return alert;
}
