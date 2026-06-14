import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// CSRF double-submit: el backend setea cookie `csrfToken` (no-httpOnly) en
// login/refresh. La leemos y la mandamos como header X-CSRF-Token en cada
// mutation.
api.interceptors.request.use((config) => {
  const csrf = getCookie('csrfToken');
  const method = (config.method ?? '').toLowerCase();
  if (csrf && ['post', 'put', 'patch', 'delete'].includes(method)) {
    config.headers.set('X-CSRF-Token', csrf);
  }
  return config;
});

// Refresh-on-401: al recibir 401 en un request, llama a /auth/refresh y
// reintenta el request original. Si refresh también falla, deja pasar el
// error. Se evita reintentos infinitos con la flag `_retry` y se serializa
// el refresh para que N requests concurrentes solo disparen uno.
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh')
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.response || !error.config) {
      return Promise.reject(error);
    }
    const cfg = error.config as RetriableConfig;
    const isAuthEndpoint = cfg.url?.startsWith('/auth/');
    if (error.response.status === 401 && !cfg._retry && !isAuthEndpoint) {
      cfg._retry = true;
      try {
        await refreshSession();
        return api.request(cfg);
      } catch {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}
