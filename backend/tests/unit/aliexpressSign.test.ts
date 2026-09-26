import { describe, expect, it } from 'vitest';
import { signAliExpressParams } from '../../src/utils/aliexpressSign.js';

describe('signAliExpressParams', () => {
  it('es determinístico para el mismo input', () => {
    const params = { b: '2', a: '1', c: '3' };
    const s1 = signAliExpressParams(params, 'secret');
    const s2 = signAliExpressParams(params, 'secret');
    expect(s1).toBe(s2);
  });

  it('ordena las keys ANTES de firmar (orden de input no importa)', () => {
    const s1 = signAliExpressParams({ b: '2', a: '1' }, 'secret');
    const s2 = signAliExpressParams({ a: '1', b: '2' }, 'secret');
    expect(s1).toBe(s2);
  });

  it('cambia si cambia cualquier valor', () => {
    const s1 = signAliExpressParams({ a: '1' }, 'secret');
    const s2 = signAliExpressParams({ a: '2' }, 'secret');
    expect(s1).not.toBe(s2);
  });

  it('devuelve hex en mayúsculas', () => {
    const s = signAliExpressParams({ a: '1' }, 'secret');
    expect(s).toMatch(/^[0-9A-F]+$/);
  });
});
