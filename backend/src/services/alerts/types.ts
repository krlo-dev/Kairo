import type { Alert, AlertDirection, AlertMode } from '@prisma/client';

export interface CreateAlertInput {
  trackedProductId: string;
  mode: AlertMode;
  direction: AlertDirection;
  targetPrice: number | null;
  pctThreshold: number | null;
  cooldownDays: number;
  notifyEmail: boolean;
  notifyWhatsapp: boolean;
}

// Definido explícitamente (en vez de derivarlo con Partial<...>) porque con
// `exactOptionalPropertyTypes: true` un campo `prop?: T` (vía Partial) sólo
// admite OMITIR la propiedad, no pasarla con valor `undefined` — y eso es
// justo lo que produce `z.object({...}).optional()` al inferir el tipo del
// body en alerts.routes.ts. Cada campo se declara `T | undefined` a propósito
// para que ese `parsed.data` (zod) sea asignable tal cual, sin casts.
export interface UpdateAlertInput {
  mode?: AlertMode | undefined;
  direction?: AlertDirection | undefined;
  targetPrice?: number | null | undefined;
  pctThreshold?: number | null | undefined;
  cooldownDays?: number | undefined;
  notifyEmail?: boolean | undefined;
  notifyWhatsapp?: boolean | undefined;
  isActive?: boolean | undefined;
}

export interface AlertListResult {
  data: Alert[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
