import { Resend } from 'resend';
import type {
  AccountLockedParams,
  EmailService,
  PasswordResetParams,
  VerifyEmailParams,
} from '../interfaces/EmailService.js';
import { env } from '../config/env.js';
import { logger } from '../logger/pino.js';
import {
  accountLockedTemplate,
  passwordResetTemplate,
  verifyEmailTemplate,
} from './emailTemplates.js';

export class ResendEmailService implements EmailService {
  private client: Resend;
  private fromDefault: string;

  constructor() {
    this.client = new Resend(env.RESEND_API_KEY);
    this.fromDefault = `Kairo <${env.RESEND_FROM_DEFAULT}>`;
  }

  async sendVerifyEmail(params: VerifyEmailParams): Promise<void> {
    const tpl = verifyEmailTemplate(params.name, params.verifyUrl);
    await this.send(params.to, tpl.subject, tpl.html, tpl.text);
  }

  async sendPasswordReset(params: PasswordResetParams): Promise<void> {
    const tpl = passwordResetTemplate(params.name, params.resetUrl);
    await this.send(params.to, tpl.subject, tpl.html, tpl.text);
  }

  async sendAccountLocked(params: AccountLockedParams): Promise<void> {
    const tpl = accountLockedTemplate(params.name, params.unlockAt);
    await this.send(params.to, tpl.subject, tpl.html, tpl.text);
  }

  private async send(to: string, subject: string, html: string, text: string): Promise<void> {
    const result = await this.client.emails.send({
      from: this.fromDefault,
      to,
      subject,
      html,
      text,
    });
    if (result.error) {
      logger.error({ err: result.error, subject }, 'resend send failed');
      throw new Error(`Resend send failed: ${result.error.message}`);
    }
  }
}
