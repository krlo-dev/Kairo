import axios, { type AxiosInstance } from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: inyecta CSRF token desde cookie no-httpOnly (lo seteará el backend).
api.interceptors.request.use((config) => {
  const csrf = getCookie('csrf-token');
  if (csrf && ['post', 'put', 'patch', 'delete'].includes((config.method ?? '').toLowerCase())) {
    config.headers.set('X-CSRF-Token', csrf);
  }
  return config;
});

// Interceptor de respuesta: en Fase 1 manejará el refresh automático en 401.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(error),
);

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}
