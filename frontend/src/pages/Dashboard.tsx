import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth.store';
import { logout as apiLogout } from '../lib/auth';
import { errorMessage } from '../lib/errorMessage';

// Placeholder de la home autenticada. La UX real (tracking grid, alertas,
// etc.) llega en Fases 3-5. Aqui solo confirma que la sesion funciona y
// permite logout.
export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const reset = useAuthStore((s) => s.reset);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!user) return null;

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

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-kairo-label uppercase tracking-wider text-kairo-amber">
            Plan {user.plan}
          </p>
          <h1 className="mt-2 text-kairo-h2 text-neutral-900 dark:text-neutral-50">
            Hola, {user.name}
          </h1>
        </div>
        <nav className="flex items-center gap-3">
          <Link to="/search" className="btn-primary text-sm">
            Buscar
          </Link>
          <Link to="/settings" className="btn-ghost text-sm">
            Ajustes
          </Link>
          <button type="button" className="btn-ghost text-sm" onClick={onLogout}>
            Salir
          </button>
        </nav>
      </header>

      <section className="mt-10 rounded-kairo border border-neutral-200 bg-white p-6 dark:border-kairo-borderDark dark:bg-kairo-surfaceDark">
        <h2 className="text-kairo-h3 text-neutral-900 dark:text-neutral-50">Tu cuenta</h2>
        <dl className="mt-4 grid grid-cols-2 gap-y-3 text-kairo-small">
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

      <p className="mt-8 text-kairo-small text-neutral-500">
        El dashboard real (tus productos rastreados, alertas, gráficos de precio) llega en las
        próximas fases.
      </p>
    </main>
  );
}
