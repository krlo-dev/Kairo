import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth.store';
import { checkout, getPlans, type Plan, type PlanInfo } from '../lib/billing';
import { errorMessage } from '../lib/errorMessage';
import { formatPrice } from '../utils/formatPrice';

const PLAN_TAGLINE: Record<Plan, string> = {
  FREE: 'Para probar Kairo sin compromiso.',
  PRO: 'Para quien compra seguido y quiere el mejor momento.',
  COMERCIANTE: 'Para revendedores e importadores que necesitan margen y volumen.',
};

export function Pricing() {
  const user = useAuthStore((s) => s.user);
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);

  const plansQuery = useQuery({ queryKey: ['billing', 'plans'], queryFn: getPlans });

  const onChoose = async (plan: PlanInfo) => {
    if (plan.plan === 'FREE') return;
    setLoadingPlan(plan.plan);
    try {
      const { initPoint } = await checkout(plan.plan as 'PRO' | 'COMERCIANTE');
      window.location.href = initPoint;
    } catch (err) {
      toast.error(errorMessage(err));
      setLoadingPlan(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10 text-center">
        <p className="text-kairo-label uppercase tracking-wider text-kairo-amber">Planes</p>
        <h1 className="mt-2 text-kairo-h1 text-neutral-900 dark:text-neutral-50">Elige tu plan</h1>
        <p className="mt-2 text-kairo-body text-neutral-500">
          Cambia o cancela cuando quieras. Precios en COP, IVA incluido.
        </p>
        {user ? (
          <Link
            to="/settings"
            className="mt-2 inline-block text-kairo-small text-kairo-amber hover:underline"
          >
            ← Volver a ajustes
          </Link>
        ) : null}
      </header>

      {plansQuery.isLoading ? (
        <p className="py-12 text-center text-kairo-body text-neutral-500">Cargando planes...</p>
      ) : plansQuery.isError ? (
        <p className="py-12 text-center text-kairo-body text-semantic-up">
          {errorMessage(plansQuery.error)}
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-3">
          {(plansQuery.data ?? []).map((plan) => {
            const isCurrent = user?.plan === plan.plan;
            return (
              <div
                key={plan.plan}
                className={`flex flex-col rounded-kairo border p-6 ${
                  plan.plan === 'PRO'
                    ? 'border-kairo-amber shadow-lg'
                    : 'border-neutral-200 dark:border-kairo-borderDark'
                } bg-white dark:bg-kairo-surfaceDark`}
              >
                <h2 className="text-kairo-h3 text-neutral-900 dark:text-neutral-50">
                  {plan.label}
                </h2>
                <p className="mt-1 text-kairo-small text-neutral-500">{PLAN_TAGLINE[plan.plan]}</p>
                <p className="mt-4 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {plan.amountCOP === null ? 'Gratis' : formatPrice(plan.amountCOP, 'COP')}
                  {plan.amountCOP !== null ? (
                    <span className="text-kairo-small font-normal text-neutral-500">/mes</span>
                  ) : null}
                </p>

                <ul className="mt-6 flex-1 space-y-2 text-kairo-small text-neutral-700 dark:text-neutral-300">
                  <li>
                    {plan.maxTrackedProducts === null
                      ? 'Productos rastreados ilimitados'
                      : `Hasta ${plan.maxTrackedProducts} productos rastreados`}
                  </li>
                  <li>Fuentes: {plan.sources.join(', ')}</li>
                  <li>Alertas por: {plan.alertChannels.join(', ')}</li>
                  {plan.canSeeTrending ? <li>Productos en tendencia</li> : null}
                  {plan.canExportCSV ? <li>Exportar a CSV</li> : null}
                  {plan.canSeeMargins ? <li>Cálculo de márgenes</li> : null}
                </ul>

                <button
                  type="button"
                  disabled={isCurrent || plan.plan === 'FREE' || loadingPlan !== null}
                  onClick={() => void onChoose(plan)}
                  className={`mt-6 text-sm ${plan.plan === 'PRO' ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {isCurrent
                    ? 'Tu plan actual'
                    : plan.plan === 'FREE'
                      ? 'Plan gratuito'
                      : loadingPlan === plan.plan
                        ? 'Redirigiendo...'
                        : 'Elegir plan'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
