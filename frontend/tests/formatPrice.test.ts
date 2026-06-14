import { describe, it, expect } from 'vitest';
import { formatPrice } from '../src/utils/formatPrice';

describe('formatPrice', () => {
  it('formatea COP con separadores locales', () => {
    const result = formatPrice(1500000, 'COP');
    expect(result).toContain('1');
    expect(result).toContain('500');
  });

  it('formatea USD', () => {
    const result = formatPrice(99, 'USD');
    expect(result).toContain('99');
    expect(result).toContain('$');
  });
});
