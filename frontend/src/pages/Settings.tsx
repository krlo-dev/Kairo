import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth.store';
import { logout as apiLogout } from '../lib/auth';
import { disconnectMl, startMlConnect } from '../lib/ml';
import { errorMessage } from '../lib/errorMessage';

// TODO Fase 5: agregar pestañas (Cuenta / Integraciones / Plan / WhatsApp).
// Por ahora sirve para conectar/desconectar Mercado Libre y cerrar sesión.

export function Settings() {
  const user = useAuthStore((s) => s.user);
  const reset = useAuthStore((s) => s.reset);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();

  // ml=connected viene del redirect del backend tras OAuth callback exitoso.
  useEffect(() => {
    if (params.get('ml') === 'connected') {
      toast.success('Mercado Libre conectado correctamente.');
      setParams({}, { replace: true });
    } else if (params.get('ml') === 'error') {
      toast.error('No se pudo conectar Mercado Libre. Intenta de nuevo.');
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

  if (!user) return null;

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
          <button type="button" onClick={onLogout} className="btn-ghost text-sm">
            Cerrar sesión
          </button>
        </div>
      </section>
    </main>
  );
}
