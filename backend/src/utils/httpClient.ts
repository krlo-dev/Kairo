import { request, type Dispatcher } from 'undici';
import { logger } from '../logger/pino.js';
import { AppError } from './errors.js';

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retry?: { attempts: number; baseDelayMs: number };
}

export interface HttpResponse<T> {
  status: number;
  data: T;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY = { attempts: 3, baseDelayMs: 200 } as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number | null, err: unknown): boolean {
  if (err) return true; // network / abort / DNS
  if (status === null) return true;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

async function readJson<T>(body: Dispatcher.ResponseData['body']): Promise<T> {
  const text = await body.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppError('upstream_invalid_response', 502, 'Respuesta inválida del proveedor');
  }
}

/**
 * Cliente HTTP outbound para servicios upstream (ML, AE, MercadoPago, Resend).
 * Usa undici con retry exponencial en 5xx/429/errores de red.
 *
 * Por qué undici y no node-fetch / axios: undici es el cliente HTTP nativo de
 * Node 18+, sin dependencias, con keep-alive automático y mejor throughput.
 */
export async function httpRequest<T>(
  url: string,
  opts: HttpRequestOptions = {},
): Promise<HttpResponse<T>> {
  const method = opts.method ?? 'GET';
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retry = opts.retry ?? DEFAULT_RETRY;
  const body =
    opts.body === undefined
      ? undefined
      : typeof opts.body === 'string'
        ? opts.body
        : JSON.stringify(opts.body);
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...(body && typeof opts.body !== 'string' ? { 'content-type': 'application/json' } : {}),
    ...(opts.headers ?? {}),
  };

  let lastErr: unknown = null;
  let lastStatus: number | null = null;

  for (let attempt = 0; attempt < retry.attempts; attempt += 1) {
    try {
      const res = await request(url, {
        method,
        headers,
        ...(body !== undefined ? { body } : {}),
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
      });
      lastStatus = res.statusCode;

      if (res.statusCode >= 200 && res.statusCode < 300) {
        const data = await readJson<T>(res.body);
        return { status: res.statusCode, data };
      }

      // 4xx no se reintenta (excepto 429); el body se lee para incluir en el error.
      const errBody = await res.body.text();
      if (!shouldRetry(res.statusCode, null)) {
        throw new AppError(
          'upstream_error',
          res.statusCode === 401 || res.statusCode === 403 ? res.statusCode : 502,
          `Upstream ${res.statusCode}: ${truncate(errBody, 200)}`,
          { upstreamStatus: res.statusCode, upstreamBody: truncate(errBody, 500) },
        );
      }
      lastErr = new AppError(
        'upstream_retriable',
        502,
        `Upstream ${res.statusCode}, reintentando`,
        { upstreamStatus: res.statusCode, body: truncate(errBody, 200) },
      );
    } catch (err) {
      if (err instanceof AppError && !shouldRetry(lastStatus, null)) throw err;
      lastErr = err;
    }

    if (attempt < retry.attempts - 1) {
      // Backoff exponencial con jitter: base * 2^attempt ± 25%.
      const delay = retry.baseDelayMs * 2 ** attempt;
      const jittered = delay * (0.75 + Math.random() * 0.5);
      logger.warn(
        {
          url,
          method,
          attempt: attempt + 1,
          status: lastStatus,
          nextDelayMs: Math.round(jittered),
        },
        'http retry',
      );
      await sleep(jittered);
    }
  }

  if (lastErr instanceof AppError) throw lastErr;
  throw new AppError('upstream_unreachable', 502, 'No se pudo contactar al proveedor', {
    cause: lastErr instanceof Error ? lastErr.message : String(lastErr),
  });
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}...`;
}
