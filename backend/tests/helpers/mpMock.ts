import { vi } from 'vitest';
import type { MercadoPagoService } from '../../src/services/mercadopago/mercadopago.service.js';

export type MpMock = ReturnType<typeof createMpMock>;

export function createMpMock() {
  return {
    createPreapproval: vi.fn(),
    getPreapproval: vi.fn(),
    updatePreapprovalStatus: vi.fn(),
    getPayment: vi.fn(),
  };
}

export function asMp(mock: MpMock): MercadoPagoService {
  return mock;
}
