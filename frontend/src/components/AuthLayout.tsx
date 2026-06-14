import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-block text-kairo-h3 font-medium text-kairo-amber">
            Kairo
          </Link>
          <p className="mt-1 text-kairo-small text-neutral-500">El momento exacto para comprar.</p>
        </div>
        <div className="rounded-kairo border border-neutral-200 bg-white p-8 shadow-sm dark:border-kairo-borderDark dark:bg-kairo-surfaceDark">
          <h1 className="text-kairo-h2 text-neutral-900 dark:text-neutral-50">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-kairo-body text-neutral-600 dark:text-neutral-300">
              {subtitle}
            </p>
          )}
          <div className="mt-6">{children}</div>
        </div>
        {footer && (
          <div className="mt-6 text-center text-kairo-small text-neutral-600 dark:text-neutral-400">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}
