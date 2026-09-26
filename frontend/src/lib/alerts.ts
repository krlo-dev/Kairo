import { api } from './api';

export type AlertMode = 'ONE_SHOT' | 'RECURRING';
export type AlertDirection = 'DOWN' | 'UP' | 'PCT';

export interface Alert {
  id: string;
  userId: string;
  trackedProductId: string;
  mode: AlertMode;
  direction: AlertDirection;
  // Prisma.Decimal serializa a string en JSON.
  targetPrice: string | null;
  pctThreshold: number | null;
  basePrice: string | null;
  cooldownDays: number;
  notifyEmail: boolean;
  notifyWhatsapp: boolean;
  isActive: boolean;
  triggered: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface CreateAlertInput {
  trackedProductId: string;
  mode: AlertMode;
  direction: AlertDirection;
  targetPrice?: number | null;
  pctThreshold?: number | null;
  cooldownDays?: number;
  notifyEmail?: boolean;
}

export type UpdateAlertInput = Partial<Omit<CreateAlertInput, 'trackedProductId'>> & {
  isActive?: boolean;
};

export async function listAlerts(trackedProductId: string): Promise<Alert[]> {
  const res = await api.get<AlertListResult>('/alerts', {
    params: { trackedProductId, limit: 50 },
  });
  return res.data.data;
}

export async function createAlert(input: CreateAlertInput): Promise<Alert> {
  const res = await api.post<{ data: Alert }>('/alerts', input);
  return res.data.data;
}

export async function updateAlert(id: string, input: UpdateAlertInput): Promise<Alert> {
  const res = await api.put<{ data: Alert }>(`/alerts/${id}`, input);
  return res.data.data;
}

export async function deleteAlert(id: string): Promise<void> {
  await api.delete(`/alerts/${id}`);
}
