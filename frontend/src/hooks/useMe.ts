import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchMe } from '../lib/auth';
import { useAuthStore } from '../store/auth.store';

// Pide /auth/me al montar y mantiene el store sincronizado.
// El backend devuelve 401 si no hay sesion; con el interceptor de api.ts
// intentara refresh automaticamente y si falla, query queda en error y
// el store en null.
export function useMe() {
  const setUser = useAuthStore((s) => s.setUser);
  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) setUser(query.data);
    else if (query.isError) setUser(null);
  }, [query.data, query.isError, setUser]);

  return query;
}
