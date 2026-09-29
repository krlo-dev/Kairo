import type { PrismaClient } from '@prisma/client';
import type { MercadoPagoService } from '../mercadopago/mercadopago.service.js';
import type { EmailService } from '../../interfaces/EmailService.js';

export interface BillingDeps {
  prisma: PrismaClient;
  mp: MercadoPagoService;
}

export interface BillingWebhookDeps {
  prisma: PrismaClient;
  mp: MercadoPagoService;
  email: EmailService;
}
