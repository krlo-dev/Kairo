import { describe, expect, it } from 'vitest';
import { maskEmail } from '../../src/utils/emailMask.js';

describe('maskEmail', () => {
  it('enmascara la parte local dejando la primera letra', () => {
    expect(maskEmail('carlos@gmail.com')).toBe('c***@gmail.com');
  });

  it('devuelve *** cuando no hay arroba', () => {
    expect(maskEmail('no-an-email')).toBe('***');
  });

  it('protege contra @ al inicio', () => {
    expect(maskEmail('@gmail.com')).toBe('***');
  });
});
