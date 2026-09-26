import { formatPrice, type Currency } from '../utils/formatPrice';
import type { UnifiedProduct } from '../lib/search';

interface Props {
  product: UnifiedProduct;
  onTrack?: (p: UnifiedProduct) => void;
  tracking?: boolean;
  tracked?: boolean;
}

const SOURCE_BADGE: Record<UnifiedProduct['source'], { label: string; classes: string }> = {
  ML: {
    label: 'ML',
    classes: 'bg-blue-100 text-semantic-info dark:bg-blue-900/40 dark:text-blue-200',
  },
  ALIEXPRESS: {
    label: 'AE',
    classes: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200',
  },
};

export function ProductCard({ product, onTrack, tracking, tracked }: Props) {
  const src = SOURCE_BADGE[product.source];
  const productHref = product.productUrl;

  return (
    <article className="flex h-full flex-col rounded-kairo border border-neutral-200 bg-white p-4 transition-colors hover:border-kairo-amber/60 dark:border-kairo-borderDark dark:bg-kairo-surfaceDark">
      <a
        href={productHref}
        target="_blank"
        rel="noopener noreferrer"
        className="block focus:outline-none focus:ring-2 focus:ring-kairo-amber/40"
      >
        <div className="flex gap-4">
          <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-kairo-navy">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-contain"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${src.classes}`}
              >
                {src.label}
              </span>
              {product.shipping?.free ? (
                <span className="text-[10px] font-medium uppercase tracking-wide text-semantic-down">
                  Envío gratis
                </span>
              ) : null}
            </div>
            <h3 className="line-clamp-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {product.title}
            </h3>
            {product.sellerNickname ? (
              <p className="mt-1 text-kairo-small text-neutral-500">{product.sellerNickname}</p>
            ) : null}
          </div>
        </div>
      </a>

      <div className="mt-4 flex items-end justify-between">
        <span className="font-semibold tabular-nums text-kairo-amber" style={{ fontSize: '20px' }}>
          {formatPrice(product.price, product.currency as Currency)}
        </span>
        {onTrack ? (
          <button
            type="button"
            onClick={() => onTrack(product)}
            disabled={tracking || tracked}
            className="btn-ghost text-sm"
          >
            {tracked ? 'Siguiendo ✓' : tracking ? 'Agregando...' : 'Seguir'}
          </button>
        ) : null}
      </div>
    </article>
  );
}
