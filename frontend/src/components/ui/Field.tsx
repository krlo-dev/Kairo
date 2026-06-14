import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Field = forwardRef<HTMLInputElement, Props>(function Field(
  { label, error, hint, className, id, ...rest },
  ref,
) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-kairo-small font-medium text-neutral-700 dark:text-neutral-200"
      >
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-kairo-body text-neutral-900 placeholder:text-neutral-400 focus:border-kairo-amber focus:outline-none focus:ring-2 focus:ring-kairo-amber/30 dark:border-kairo-borderDark dark:bg-kairo-navy dark:text-neutral-50',
          error && 'border-semantic-up focus:border-semantic-up focus:ring-semantic-up/30',
          className,
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="mt-1 text-kairo-small text-semantic-up">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1 text-kairo-small text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
