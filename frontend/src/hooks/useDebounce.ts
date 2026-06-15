import { useEffect, useState } from 'react';

// Hook genérico de debounce. Reusado por SearchBar para no disparar un
// fetch en cada keystroke (default 300ms).
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
