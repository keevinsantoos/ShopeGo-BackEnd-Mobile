import crypto from 'node:crypto';

import type {
  CreatePaymentInput,
  PaymentIntentResult,
  PaymentIntentStatus,
  PaymentProvider,
} from './payment.types.js';

export class MockPaymentProvider implements PaymentProvider {
  public readonly name = 'mock' as const;

  async createPayment(input: CreatePaymentInput): Promise<PaymentIntentResult> {
    const externalPaymentId = `mock_${crypto.randomUUID()}`;
    const pixCode =
      input.method === 'pix'
        ? `00020126580014BR.GOV.BCB.PIX0136shopego-${input.orderId}5204000053039865406${input.amount.toFixed(2)}5802BR5913SHOPEGO STORE6009SAO PAULO62070503***6304MOCK`
        : undefined;

    return {
      provider: 'mock',
      externalPaymentId,
      status: 'pending',
      pixQrCode: pixCode,
    };
  }

  async getPaymentStatus(_externalPaymentId: string): Promise<{
    orderId?: string;
    status: PaymentIntentStatus;
  }> {
    return { status: 'approved' };
  }
}
