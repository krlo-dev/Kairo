import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/utils/password.js';

describe('password util', () => {
  it('hashea con bcrypt cost 12 y verifica correctamente', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('$2b$12$')).toBe(true);
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });

  it('produce hashes distintos para la misma contraseña (salt aleatorio)', async () => {
    const a = await hashPassword('hello123');
    const b = await hashPassword('hello123');
    expect(a).not.toBe(b);
  });
});
