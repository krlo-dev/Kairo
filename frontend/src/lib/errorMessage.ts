import { isAxiosError } from 'axios';

// Extrae el mensaje "humano" de una respuesta de error de nuestra API,
// que siempre devuelve `{ error: { code, message } }`. Si el error no
// viene de axios, devuelve un fallback genérico.
export function errorMessage(err: unknown, fallback = 'Algo salió mal. Intenta de nuevo'): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { error?: { message?: string } } | undefined;
    if (data?.error?.message) return data.error.message;
    if (err.code === 'ECONNABORTED') return 'Tiempo de espera agotado';
    if (!err.response) return 'Sin conexión con el servidor';
  }
  return fallback;
}
