import type {
  AccountLockedParams,
  AlertTriggeredParams,
  EmailService,
  PasswordResetParams,
  PlanDowngradedParams,
  VerifyEmailParams,
} from '../interfaces/EmailService.js';
import { logger } from '../logger/pino.js';

// Implementación que solo loguea — útil cuando RESEND_API_KEY no está
// configurada (dev local antes de crear cuenta Resend) o en tests.
// El link de verificación se imprime para que el dev pueda copiarlo.

export class ConsoleEmailService implements EmailService {
  async sendVerifyEmail(params: VerifyEmailParams): Promise<void> {
    logger.warn(
      { to: params.to, verifyUrl: params.verifyUrl },
      '[console-email] verify-email (no Resend configurada)',
    );
    return Promise.resolve();
  }

  async sendPasswordReset(params: PasswordResetParams): Promise<void> {
    logger.warn(
      { to: params.to, resetUrl: params.resetUrl },
      '[console-email] password-reset (no Resend configurada)',
    );
    return Promise.resolve();
  }

  async sendAccountLocked(params: AccountLockedParams): Promise<void> {
    logger.warn(
      { to: params.to, unlockAt: params.unlockAt.toISOString() },
      '[console-email] account-locked (no Resend configurada)',
    );
    return Promise.resolve();
  }

  async sendAlertTriggered(params: AlertTriggeredParams): Promise<void> {
    logger.warn(
      { to: params.to, productTitle: params.productTitle, price: params.price },
      '[console-email] alert-triggered (no Resend configurada)',
    );
    return Promise.resolve();
  }

  async sendPlanDowngraded(params: PlanDowngradedParams): Promise<void> {
    logger.warn(
      { to: params.to, fromPlan: params.fromPlan },
      '[console-email] plan-downgraded (no Resend configurada)',
    );
    return Promise.resolve();
  }
}
