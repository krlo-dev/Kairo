import { createHmac } from 'node:crypto';

/**
 * Firma de requests para el AliExpress Open Platform (TOP) API — usada por
 * el Affiliate API (aliexpress.affiliate.product.query, etc.).
 *
 * Algoritmo (HMAC-SHA256, el que documenta el portal para apps nuevas):
 *   1. Ordenar TODOS los parámetros (sistema + negocio) por key ASC.
 *   2. Concatenar como key1value1key2value2... (sin separadores).
 *   3. HMAC-SHA256(base, app_secret) en hex, en MAYÚSCULAS.
 *
 * Referencia: https://openservice.aliexpress.com/doc/doc.htm (Signature)
 */
export function signAliExpressParams(params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  const base = sortedKeys.map((key) => `${key}${params[key]}`).join('');
  return createHmac('sha256', appSecret).update(base, 'utf8').digest('hex').toUpperCase();
}
