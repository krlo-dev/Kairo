import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Field } from '../components/ui/Field';
import { ProductCard } from '../components/ProductCard';
import { searchProducts, type SearchParams } from '../lib/search';
import { useDebounce } from '../hooks/useDebounce';
import { errorMessage } from '../lib/errorMessage';
import { useAuthStore } from '../store/auth.store';

const COUNTRIES_BY_PLAN: Record<string, string[]> = {
  FREE: ['CO'],
  PRO: ['CO', 'MX', 'AR', 'CL', 'BR', 'PE'],
  COMERCIANTE: ['CO', 'MX', 'AR', 'CL', 'BR', 'PE'],
};

const COUNTRY_LABEL: Record<string, string> = {
  CO: 'Colombia',
  MX: 'México',
  AR: 'Argentina',
  CL: 'Chile',
  BR: 'Brasil',
  PE: 'Perú',
};

export function Search() {
  const user = useAuthStore((s) => s.user);
  const allowedCountries = user ? (COUNTRIES_BY_PLAN[user.plan] ?? ['CO']) : ['CO'];

  const [q, setQ] = useState('');
  const [country, setCountry] = useState(allowedCountries[0] ?? 'CO');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [page, setPage] = useState(1);

  const dq = useDebounce(q, 300);
  const dmin = useDebounce(minPrice, 400);
  const dmax = useDebounce(maxPrice, 400);

  const params: SearchParams | null = useMemo(() => {
    if (dq.trim().length < 2) return null;
    return {
      q: dq.trim(),
      country,
      page,
      ...(dmin ? { minPrice: Number(dmin) } : {}),
      ...(dmax ? { maxPrice: Number(dmax) } : {}),
    };
  }, [dq, country, dmin, dmax, page]);

  const query = useQuery({
    queryKey: ['search', params],
    queryFn: () => {
      if (!params) throw new Error('no params');
      return searchProducts(params);
    },
    enabled: params !== null,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-kairo-h2 text-neutral-900 dark:text-neutral-50">Buscar</h1>
        <Link to="/dashboard" className="text-kairo-small text-kairo-amber hover:underline">
          ← Dashboard
        </Link>
      </header>

      <section className="space-y-4 rounded-kairo border border-neutral-200 bg-white p-5 dark:border-kairo-borderDark dark:bg-kairo-surfaceDark">
        <Field
          label="¿Qué buscas?"
          placeholder="Ej: iPhone 15, freidora de aire, audífonos bluetooth"
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-kairo-small font-medium text-neutral-700 dark:text-neutral-200">
              País
            </label>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setPage(1);
              }}
              className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-kairo-body text-neutral-900 focus:border-kairo-amber focus:outline-none focus:ring-2 focus:ring-kairo-amber/30 dark:border-kairo-borderDark dark:bg-kairo-navy dark:text-neutral-50"
            >
              {allowedCountries.map((c) => (
                <option key={c} value={c}>
                  {COUNTRY_LABEL[c] ?? c}
                </option>
              ))}
            </select>
            {user?.plan === 'FREE' && allowedCountries.length === 1 ? (
              <p className="mt-1 text-kairo-small text-neutral-500">
                Tu plan FREE rastrea Colombia.{' '}
                <Link to="/settings" className="text-kairo-amber hover:underline">
                  Actualiza a Pro
                </Link>{' '}
                para más países.
              </p>
            ) : null}
          </div>
          <Field
            label="Precio mínimo"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            value={minPrice}
            onChange={(e) => {
              setMinPrice(e.target.value);
              setPage(1);
            }}
          />
          <Field
            label="Precio máximo"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Sin límite"
            value={maxPrice}
            onChange={(e) => {
              setMaxPrice(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </section>

      <section className="mt-8">
        {q.trim().length < 2 ? (
          <p className="py-12 text-center text-kairo-body text-neutral-500">
            Empieza a escribir para buscar productos.
          </p>
        ) : query.isLoading ? (
          <SkeletonGrid />
        ) : query.isError ? (
          <p className="py-12 text-center text-kairo-body text-semantic-up">
            {errorMessage(query.error)}
          </p>
        ) : query.data && query.data.data.length === 0 ? (
          <p className="py-12 text-center text-kairo-body text-neutral-500">
            No encontramos resultados para <strong>{dq}</strong>. Prueba otros términos.
          </p>
        ) : query.data ? (
          <>
            <p className="mb-3 text-kairo-small text-neutral-500">
              {query.data.pagination.total.toLocaleString('es-CO')} resultados — página{' '}
              {query.data.pagination.page} de {query.data.pagination.totalPages}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {query.data.data.map((p) => (
                <ProductCard key={`${p.source}-${p.externalId}`} product={p} />
              ))}
            </div>
            {query.data.pagination.totalPages > 1 ? (
              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  disabled={page <= 1 || query.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Anterior
                </button>
                <span className="text-kairo-small text-neutral-500">
                  Página {page} / {query.data.pagination.totalPages}
                </span>
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  disabled={page >= query.data.pagination.totalPages || query.isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente →
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-44 animate-pulse rounded-kairo border border-neutral-200 bg-neutral-100 dark:border-kairo-borderDark dark:bg-kairo-surfaceDark"
        />
      ))}
    </div>
  );
}
