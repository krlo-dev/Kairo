import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from '../../src/utils/jwt.js';
import { AppError } from '../../src/utils/errors.js';

describe('jwt util', () => {
  it('round-trip de access token preserva claims', () => {
    const token = signAccessToken({ sub: 'user-123', plan: 'FREE' });
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('user-123');
    expect(decoded.plan).toBe('FREE');
  });

  it('verify rechaza un token con firma alterada', () => {
    const token = signAccessToken({ sub: 'user-123', plan: 'FREE' });
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'bb' : 'aa');
    expect(() => verifyAccessToken(tampered)).toThrowError(AppError);
  });

  it('verify rechaza basura', () => {
    expect(() => verifyAccessToken('not-a-jwt')).toThrowError(AppError);
  });
});
