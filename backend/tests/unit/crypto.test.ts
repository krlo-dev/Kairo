import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, sha256, randomToken } from '../../src/utils/crypto.js';

describe('crypto utils', () => {
  it('encrypt/decrypt round-trip preserves plaintext', () => {
    const plaintext = 'hello-secret-token-12345';
    const ct = encrypt(plaintext);
    expect(ct).not.toBe(plaintext);
    expect(ct.split(':')).toHaveLength(3);
    expect(decrypt(ct)).toBe(plaintext);
  });

  it('encrypting the same plaintext twice yields different ciphertexts (random IV)', () => {
    const a = encrypt('same');
    const b = encrypt('same');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same');
    expect(decrypt(b)).toBe('same');
  });

  it('sha256 returns deterministic hex digest', () => {
    expect(sha256('kairo')).toBe(sha256('kairo'));
    expect(sha256('kairo')).toHaveLength(64);
  });

  it('randomToken returns hex of expected length', () => {
    expect(randomToken(16)).toHaveLength(32);
    expect(randomToken(32)).toHaveLength(64);
  });
});
