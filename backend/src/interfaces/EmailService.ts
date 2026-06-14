export interface VerifyEmailParams {
  to: string;
  name: string;
  verifyUrl: string;
}

export interface PasswordResetParams {
  to: string;
  name: string;
  resetUrl: string;
}

export interface AccountLockedParams {
  to: string;
  name: string;
  unlockAt: Date;
}

export interface EmailService {
  sendVerifyEmail(params: VerifyEmailParams): Promise<void>;
  sendPasswordReset(params: PasswordResetParams): Promise<void>;
  sendAccountLocked(params: AccountLockedParams): Promise<void>;
}
