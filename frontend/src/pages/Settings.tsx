import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth.store';
import { logout as apiLogout } from '../lib/auth';
import { disconnectMl, startMlConnect } from '../lib/ml';
import { errorMessage } from '../lib/errorMessage';
import { cancelSubscription, getBillingStatus, reactivateSubscription } from '../lib/billing';
import { formatPrice } from '../utils/formatPrice';

const PLAN_LABEL: Record<string, string> = { FREE: 'Free', PRO: 'Pro', COMERCIANTE: 'Comerciante' };
const STATUS_LABEL: Record<string, string> = {
  INCOMPLETE: 'Pago pendiente',
  TRIALING: 'En prueba',
  ACTIVE: 'Activa',
  PAST_DUE: 'Pago fallido — reintentando',
  CANCELED: 'Cancelada',
  UNPAID: 'Sin pagar',
};

export function Settings() {
  const user = useAuthStore((s) => s.user);
  const reset = useAuthStore((s) => s.reset);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();

  // ml=connected viene del redirect del backend tras OAuth callback exitoso.
  // billing=success viene del back_url que le pasamos a MercadoPago al crear
  // el preapproval — no confirma el pago (eso lo hace el webhook), solo trae
  // de vuelta al user para que vea el estado actualizándose.
  useEffect(() => {
    if (params.get('ml') === 'connected') {
      toast.success('Mercado Libre conectado correctamente.');
      setParams({}, { replace: true });
    } else if (params.get('ml') === 'error') {
      toast.error('No se pudo conectar Mercado Libre. Intenta de nuevo.');
      setParams({}, { replace: true });
    } else if (params.get('billing') === 'success') {
      toast.success('Gracias — estamos confirmando tu pago con MercadoPago.');
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const [disconnecting, setDisconnecting] = useState(false);
  const onDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectMl();
      toast.success('Mercado Libre desconectado.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDisconnecting(false);
    }
  };

  const onLogout = async () => {
    try {
      await apiLogout();
    } catch (err) {
      toast.error(errorMessage(err));
    }
    reset();
    queryClient.removeQueries({ queryKey: ['auth', 'me'] });
    navigate('/login', { replace: true });
  };

  const billingQuery = useQuery({
    queryKey: ['billing', 'status'],
    queryFn: getBillingStatus,
    enabled: !!user,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      toast.success('Tu suscripción se cancelará al fin del período actual.');
      void queryClient.invalidateQueries({ queryKey: ['billing', 'status'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateSubscription,
    onSuccess: () => {
      toast.success('Tu suscripción sigue activa — cancelación revertida.');
      void queryClient.invalidateQueries({ queryKey: ['billing', 'status'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!user) return null;

  const subscription = billingQuery.data?.subscription ?? null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-kairo-label uppercase tracking-wider text-kairo-amber">Cuenta</p>
          <h1 className="mt-2 text-kairo-h2 text-neutral-900 dark:text-neutral-50">Ajustes</h1>
        </div>
        <Link to="/dashboard" className="text-kairo-small text-kairo-amber hover:underline">
          ← Dashboard
        </Link>
      </header>

      <section className="space-y-3 rounded-kairo border border-neutral-200 bg-white p-6 dark:border-kairo-borderDark dark:bg-kairo-surfaceDark">
        <h2 className="text-kairo-h3 text-neutral-900 dark:text-neutral-50">Tu cuenta</h2>
        <dl className="grid grid-cols-2 gap-y-2 text-kairo-small">
          <dt className="text-neutral-500">Email</dt>
          <dd className="text-neutral-900 dark:text-neutral-100">{user.email}</dd>
          <dt className="text-neutral-500">Plan</dt>
          <dd className="text-neutral-900 dark:text-neutral-100">{user.plan}</dd>
          <dt className="text-neutral-500">Miembro desde</dt>
          <dd className="text-neutral-900 dark:text-neutral-100">
            {new Date(user.createdAt).toLocaleDateString('es-CO')}
          </dd>
        </dl>
      </section>

      <section className="mt-6 space-y-3 rounded-kairo border border-neutral-200 bg-white p-6 dark:border-kairo-borderDark dark:bg-kairo-surfaceDark">
        <div className="flex items-center justify-between">
          <h2 className="text-kairo-h3 text-neutral-900 dark:text-neutral-50">
            Plan y facturación
          </h2>
          <Link to="/pricing" className="text-kairo-small text-kairo-amber hover:underline">
            Ver planes
          </Link>
        </div>

        {billingQuery.isLoading ? (
          <p className="text-kairo-small text-neutral-500">Cargando...</p>
        ) : !subscription ? (
          <p className="text-kairo-small text-neutral-500">
            Estás en el plan <strong>Free</strong>. Sube de plan cuando quieras desde{' '}
            <Link to="/pricing" className="text-kairo-amber hover:underline">
              planes
            </Link>
            .
          </p>
        ) : (
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-kairo-borderDark">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  {PLAN_LABEL[subscription.plan] ?? subscription.plan}
                </p>
                <p className="text-kairo-small text-neutral-500">
                  {STATUS_LABEL[subscription.status] ?? subscription.status}
                  {subscription.currentPeriodEnd
                    ? ` — próximo cobro/vencimiento: ${new Date(
                        subscription.currentPeriodEnd,
                      ).toLocaleDateString('es-CO')}`
                    : ''}
                </p>
                {subscription.cancelAtPeriodEnd ? (
                  <p className="mt-1 text-kairo-small text-semantic-up">
                    Programada para cancelarse al fin del período.
                  </p>
                ) : null}
              </div>
              {subscription.status === 'ACTIVE' && !subscription.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                >
                  {cancelMutation.isPending ? 'Cancelando...' : 'Cancelar suscripción'}
                </button>
              ) : subscription.status === 'ACTIVE' && subscription.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={reactivateMutation.isPending}
                  onClick={() => reactivateMutation.mutate()}
                >
                  {reactivateMutation.isPending ? 'Reactivando...' : 'Reactivar'}
                </button>
              ) : null}
            </div>

            {billingQuery.data && billingQuery.data.payments.length > 0 ? (
              <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-kairo-borderDark">
                <p className="mb-2 text-kairo-small font-medium text-neutral-700 dark:text-neutral-200">
                  Últimos pagos
                </p>
                <ul className="space-y-1 text-kairo-small text-neutral-500">
                  {billingQuery.data.payments.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span>{new Date(p.createdAt).toLocaleDateString('es-CO')}</span>
                      <span>{formatPrice(Number(p.amount), p.currency as never)}</span>
                      <span>{p.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="mt-6 space-y-3 rounded-kairo border border-neutral-200 bg-white p-6 dark:border-kairo-borderDark dark:bg-kairo-surfaceDark">
        <h2 className="text-kairo-h3 text-neutral-900 dark:text-neutral-50">Integraciones</h2>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 p-4 dark:border-kairo-borderDark">
          <div>
            <p className="font-medium text-neutral-900 dark:text-neutral-100">Mercado Libre</p>
            <p className="text-kairo-small text-neutral-500">
              Conecta tu cuenta para obtener detalles privados de productos que rastreas.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={startMlConnect} className="btn-primary text-sm">
              Conectar
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              disabled={disconnecting}
              className="btn-ghost text-sm"
            >
              {disconnecting ? '...' : 'Desconectar'}
            </button>
          </div>
        </div>
        <p className="text-kairo-small text-neutral-500">
          La búsqueda pública funciona sin conectar — la conexión solo es necesaria para tracking
          detallado.
        </p>
      </section>

      <section className="mt-6 rounded-kairo border border-neutral-200 bg-white p-6 dark:border-kairo-borderDark dark:bg-kairo-surfaceDark">
        <h2 className="text-kairo-h3 text-neutral-900 dark:text-neutral-50">Sesión</h2>
        <div className="mt-3">
          <button type="button" onClick={() => void onLogout()} className="btn-ghost text-sm">
            Cerrar sesión
          </button>
        </div>
      </section>
    </main>
  );
}
