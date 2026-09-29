import type { PrismaClient, Subscription, Payment } from '@prisma/client';

export interface BillingStatus {
  subscription: Subscription | null;
  payments: Payment[];
}

export interface GetStatusDeps {
  prisma: PrismaClient;
}

// GET /billing/status — estado de la suscripción del user + últimos pagos,
// para la sección "Plan y facturación" de Settings.
export async function getBillingStatus(
  deps: GetStatusDeps,
  userId: string,
): Promise<BillingStatus> {
  const [subscription, payments] = await Promise.all([
    deps.prisma.subscription.findUnique({ where: { userId } }),
    deps.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);
  return { subscription, payments };
}
