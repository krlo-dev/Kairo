import { api } from './api';

export type Plan = 'FREE' | 'PRO' | 'COMERCIANTE';
export type SubscriptionStatus =
  | 'INCOMPLETE'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID';
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED' | 'CHARGED_BACK';

export interface PlanInfo {
  plan: Plan;
  label: string;
  amountCOP: number | null;
  maxTrackedProducts: number | null;
  sources: readonly string[];
  alertChannels: readonly string[];
  canSeeTrending: boolean;
  canExportCSV: boolean;
  canSeeMargins: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: Plan;
  status: SubscriptionStatus;
  mpPreapprovalId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  mpPaymentId: string;
  amount: string; // Decimal serializado como string
  currency: string;
  status: PaymentStatus;
  method: string | null;
  paidAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface BillingStatus {
  subscription: Subscription | null;
  payments: Payment[];
}

export async function getPlans(): Promise<PlanInfo[]> {
  const res = await api.get<{ data: PlanInfo[] }>('/billing/plans');
  return res.data.data;
}

export async function checkout(plan: 'PRO' | 'COMERCIANTE'): Promise<{ initPoint: string }> {
  const res = await api.post<{ data: { initPoint: string } }>('/billing/checkout', { plan });
  return res.data.data;
}

export async function getBillingStatus(): Promise<BillingStatus> {
  const res = await api.get<{ data: BillingStatus }>('/billing/status');
  return res.data.data;
}

export async function cancelSubscription(): Promise<Subscription> {
  const res = await api.post<{ data: Subscription }>('/billing/cancel');
  return res.data.data;
}

export async function reactivateSubscription(): Promise<Subscription> {
  const res = await api.post<{ data: Subscription }>('/billing/reactivate');
  return res.data.data;
}
