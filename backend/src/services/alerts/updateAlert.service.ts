import type { Alert, PrismaClient } from '@prisma/client';
import { AppError, Errors } from '../../utils/errors.js';
import { recordAudit } from '../../utils/auditLog.js';
import type { UpdateAlertInput } from './types.js';

export interface AlertDeps {
  prisma: PrismaClient;
}

export async function updateAlert(
  deps: AlertDeps,
  alert: Alert,
  input: UpdateAlertInput,
): Promise<Alert> {
  if (input.notifyWhatsapp) {
    throw new AppError(
      'whatsapp_not_available',
      400,
      'Las notificaciones por WhatsApp todavía no están disponibles en Kairo.',
    );
  }

  const direction = input.direction ?? alert.direction;
  const targetPrice = input.targetPrice !== undefined ? input.targetPrice : alert.targetPrice;
  const pctThreshold = input.pctThreshold !== undefined ? input.pctThreshold : alert.pctThreshold;
  if (direction === 'PCT' && pctThreshold === null) {
    throw Errors.validation('direction PCT requiere pctThreshold.');
  }
  if (direction !== 'PCT' && targetPrice === null) {
    throw Errors.validation('direction DOWN/UP requiere targetPrice.');
  }

  // Editar una alerta implica que el usuario la quiere vigilando de nuevo:
  // si algún campo que afecta la condición cambió, se resetea el estado de
  // disparo para que pueda volver a evaluarse (relevante sobre todo para
  // ONE_SHOT, que si no nunca volvería a dispararse tras editarla).
  const conditionChanged =
    (input.mode !== undefined && input.mode !== alert.mode) ||
    (input.direction !== undefined && input.direction !== alert.direction) ||
    (input.targetPrice !== undefined && input.targetPrice !== numOrNull(alert.targetPrice)) ||
    (input.pctThreshold !== undefined && input.pctThreshold !== alert.pctThreshold);

  const updated = await deps.prisma.alert.update({
    where: { id: alert.id },
    data: {
      ...(input.mode !== undefined ? { mode: input.mode } : {}),
      ...(input.direction !== undefined ? { direction: input.direction } : {}),
      ...(input.targetPrice !== undefined ? { targetPrice: input.targetPrice } : {}),
      ...(input.pctThreshold !== undefined ? { pctThreshold: input.pctThreshold } : {}),
      ...(input.cooldownDays !== undefined ? { cooldownDays: input.cooldownDays } : {}),
      ...(input.notifyEmail !== undefined ? { notifyEmail: input.notifyEmail } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(conditionChanged ? { triggered: false, lastTriggeredAt: null } : {}),
    },
  });

  await recordAudit(deps.prisma, {
    userId: alert.userId,
    action: 'alert_update',
    resource: 'alert',
    resourceId: alert.id,
  });

  return updated;
}

function numOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
}
