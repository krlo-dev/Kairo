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

export interface AlertTriggeredParams {
  to: string;
  name: string;
  productTitle: string;
  productUrl: string;
  price: number;
  currency: string;
  targetPrice: number | null;
}

export interface PlanDowngradedParams {
  to: string;
  name: string;
  fromPlan: string;
}

export interface EmailService {
  sendVerifyEmail(params: VerifyEmailParams): Promise<void>;
  sendPasswordReset(params: PasswordResetParams): Promise<void>;
  sendAccountLocked(params: AccountLockedParams): Promise<void>;
  sendAlertTriggered(params: AlertTriggeredParams): Promise<void>;
  sendPlanDowngraded(params: PlanDowngradedParams): Promise<void>;
}
