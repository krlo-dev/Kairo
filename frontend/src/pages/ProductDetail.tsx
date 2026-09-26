import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getTrackedProduct, getTrackedProductHistory, removeTrackedProduct } from '../lib/tracking';
import { errorMessage } from '../lib/errorMessage';
import { formatPrice, type Currency } from '../utils/formatPrice';

const SOURCE_LABEL: Record<'ML' | 'ALIEXPRESS', string> = {
  ML: 'Mercado Libre',
  ALIEXPRESS: 'AliExpress',
};

const RANGE_OPTIONS = [7, 30, 90] as const;

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [days, setDays] = useState<(typeof RANGE_OPTIONS)[number]>(30);

  const productQuery = useQuery({
    queryKey: ['tracking', 'detail', id],
    queryFn: () => getTrackedProduct(id!),
    enabled: !!id,
  });

  const historyQuery = useQuery({
    queryKey: ['tracking', 'history', id, days],
    queryFn: () => getTrackedProductHistory(id!, days),
    enabled: !!id,
  });

  const removeMutation = useMutation({
    mutationFn: () => removeTrackedProduct(id!),
    onSuccess: () => {
      toast.success('Producto eliminado de tu dashboard.');
      void queryClient.invalidateQueries({ queryKey: ['tracking', 'list'] });
      navigate('/dashboard', { replace: true });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!id) return null;

  const product = productQuery.data;
  const history = historyQuery.data ?? [];
  const chartData = history.map((p) => ({
    date: new Date(p.recordedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
    price: p.price,
  }));

  const locked = product?.lockedUntil ? new Date(product.lockedUntil) : null;
  const isLocked = locked ? locked.getTime() > Date.now() : false;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-6 flex items-center justify-between">
        <Link to="/dashboard" className="text-kairo-small text-kairo-amber hover:underline">
          ← Dashboard
        </Link>
      </header>

      {productQuery.isLoading ? (
        <p className="py-12 text-center text-kairo-body text-neutral-500">Cargando...</p>
      ) : productQuery.isError ? (
        <p className="py-12 text-center text-kairo-body text-semantic-up">
          {errorMessage(productQuery.error)}
        </p>
      ) : product ? (
        <>
          <section className="rounded-kairo border border-neutral-200 bg-white p-6 dark:border-kairo-borderDark dark:bg-kairo-surfaceDark">
            <div className="flex gap-4">
              <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-kairo-navy">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt="" className="h-full w-full object-contain" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-kairo-small text-neutral-500">{SOURCE_LABEL[product.source]}</p>
                <a
                  href={product.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-kairo-h3 text-neutral-900 hover:underline dark:text-neutral-50"
                >
                  {product.title}
                </a>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-kairo-amber">
                  {formatPrice(Number(product.currentPrice), product.currency as Currency)}
                </p>
                {isLocked && locked ? (
                  <p className="mt-1 text-kairo-small text-neutral-400">
                    Bloqueado hasta {locked.toLocaleDateString('es-CO')} (plan FREE)
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="btn-ghost text-sm"
                disabled={isLocked || removeMutation.isPending}
                title={isLocked ? 'No puedes quitarlo mientras esté bloqueado' : undefined}
                onClick={() => removeMutation.mutate()}
              >
                {removeMutation.isPending ? 'Quitando...' : 'Quitar de mi dashboard'}
              </button>
            </div>
          </section>

          <section className="mt-6 rounded-kairo border border-neutral-200 bg-white p-6 dark:border-kairo-borderDark dark:bg-kairo-surfaceDark">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-kairo-h3 text-neutral-900 dark:text-neutral-50">
                Historial de precio
              </h2>
              <div className="flex gap-1">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDays(opt)}
                    className={`rounded-full px-3 py-1 text-kairo-small ${
                      days === opt
                        ? 'bg-kairo-amber text-white'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-kairo-navy dark:text-neutral-300'
                    }`}
                  >
                    {opt}d
                  </button>
                ))}
              </div>
            </div>

            {historyQuery.isLoading ? (
              <div className="h-64 animate-pulse rounded-lg bg-neutral-100 dark:bg-kairo-navy" />
            ) : chartData.length < 2 ? (
              <p className="py-12 text-center text-kairo-small text-neutral-500">
                Todavía no hay suficiente historial para graficar. Vuelve más tarde, el precio se
                revisa periódicamente.
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis
                      fontSize={12}
                      domain={['auto', 'auto']}
                      tickFormatter={(v: number) => formatPrice(v, product.currency as Currency)}
                      width={90}
                    />
                    <Tooltip
                      formatter={(value: number) =>
                        formatPrice(value, product.currency as Currency)
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#d97706"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
