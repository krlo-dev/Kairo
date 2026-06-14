import { vi } from 'vitest';
import type { EmailService } from '../../src/interfaces/EmailService.js';

export type EmailMock = ReturnType<typeof createEmailMock>;

export function createEmailMock() {
  const sendVerifyEmail = vi.fn().mockResolvedValue(undefined);
  const sendPasswordReset = vi.fn().mockResolvedValue(undefined);
  const sendAccountLocked = vi.fn().mockResolvedValue(undefined);
  return { sendVerifyEmail, sendPasswordReset, sendAccountLocked };
}

export function asEmail(mock: EmailMock): EmailService {
  return mock;
}
