import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth.store';
import { logout as apiLogout } from '../lib/auth';
import { errorMessage } from '../lib/errorMessage';
import { listTrackedProducts, removeTrackedProduct, type TrackedProduct } from '../lib/tracking';
import { formatPrice, type Currency } from '../utils/formatPrice';

const SOURCE_LABEL: Record<TrackedProduct['source'], string> = {
  ML: 'Mercado Libre',
  ALIEXPRESS: 'AliExpress',
};

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const reset = useAuthStore((s) => s.reset);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const trackedQuery = useQuery({
    queryKey: ['tracking', 'list'],
    queryFn: () => listTrackedProducts(1, 50),
    enabled: !!user,
  });

  const [removingId, setRemovingId] = useState<string | null>(null);

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeTrackedProduct(id),
    onMutate: (id) => setRemovingId(id),
    onSuccess: () => {
      toast.success('Producto eliminado de tu dashboard.');
      void queryClient.invalidateQueries({ queryKey: ['tracking', 'list'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => setRemovingId(null),
  });

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

  const products = trackedQuery.data?.data ?? [];

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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-kairo-h3 text-neutral-900 dark:text-neutral-50">
            Productos rastreados
          </h2>
          {trackedQuery.data ? (
            <span className="text-kairo-small text-neutral-500">
              {trackedQuery.data.pagination.total} en total
            </span>
          ) : null}
        </div>

        {trackedQuery.isLoading ? (
          <p className="py-8 text-center text-kairo-small text-neutral-500">Cargando...</p>
        ) : trackedQuery.isError ? (
          <p className="py-8 text-center text-kairo-small text-semantic-up">
            {errorMessage(trackedQuery.error)}
          </p>
        ) : products.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-kairo-body text-neutral-500">
              Todavía no estás rastreando ningún producto.
            </p>
            <Link to="/search" className="btn-primary mt-4 inline-block text-sm">
              Buscar productos
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-kairo-borderDark">
            {products.map((p) => {
              const locked = p.lockedUntil ? new Date(p.lockedUntil) : null;
              const isLocked = locked ? locked.getTime() > Date.now() : false;
              return (
                <li key={p.id} className="flex items-center gap-4 py-4">
                  <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-kairo-navy">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/tracking/${p.id}`}
                      className="line-clamp-1 text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-100"
                    >
                      {p.title}
                    </Link>
                    <p className="mt-0.5 text-kairo-small text-neutral-500">
                      {SOURCE_LABEL[p.source]} ·{' '}
                      {formatPrice(Number(p.currentPrice), p.currency as Currency)}
                    </p>
                    {isLocked && locked ? (
                      <p className="mt-0.5 text-kairo-small text-neutral-400">
                        Bloqueado hasta {locked.toLocaleDateString('es-CO')} (plan FREE)
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn-ghost text-sm"
                    disabled={isLocked || removingId === p.id}
                    title={isLocked ? 'No puedes quitarlo mientras esté bloqueado' : undefined}
                    onClick={() => removeMutation.mutate(p.id)}
                  >
                    {removingId === p.id ? 'Quitando...' : 'Quitar'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-kairo border border-neutral-200 bg-white p-6 dark:border-kairo-borderDark dark:bg-kairo-surfaceDark">
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
    </main>
  );
}
