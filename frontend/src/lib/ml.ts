import { api } from './api';

// El backend redirige a https://auth.mercadolibre.com.co/... desde el browser.
// Si lo llamamos via axios, axios sigue el redirect y se rompe el flow (auth
// de ML necesita ser cargado en window.location, no en un XHR). Por eso aquí
// usamos navegación directa.
export function startMlConnect(): void {
  const apiBase = api.defaults.baseURL ?? '/api';
  window.location.href = `${apiBase}/auth/ml/connect`;
}

export async function disconnectMl(): Promise<void> {
  await api.delete('/auth/ml');
}
