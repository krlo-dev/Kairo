import { describe, expect, it } from 'vitest';
import { csrfTokensMatch, newCsrfToken } from '../../src/utils/csrf.js';

describe('csrf util', () => {
  it('newCsrfToken produce hex de 64 chars', () => {
    const t = newCsrfToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it('csrfTokensMatch acepta iguales y rechaza distintos', () => {
    const a = newCsrfToken();
    expect(csrfTokensMatch(a, a)).toBe(true);
    expect(csrfTokensMatch(a, newCsrfToken())).toBe(false);
  });

  it('rechaza tokens de distinta longitud sin comparar', () => {
    expect(csrfTokensMatch('abc', 'abcd')).toBe(false);
  });
});
