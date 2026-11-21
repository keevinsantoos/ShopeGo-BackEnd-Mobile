import { describe, expect, it } from 'vitest';

import { MockPaymentProvider } from '../src/modules/payments/mock.provider.js';

describe('MockPaymentProvider', () => {
  it('gera código Pix simulado quando o método é pix', async () => {
    const provider = new MockPaymentProvider();
    const result = await provider.createPayment({
      orderId: 'order-123',
      amount: 122.72,
      method: 'pix',
      description: 'Pedido ShopGo #order-12',
    });

    expect(result.provider).toBe('mock');
    expect(result.status).toBe('pending');
    expect(result.externalPaymentId).toMatch(/^mock_/);
    expect(result.pixQrCode).toContain('order-123');
    expect(result.pixQrCode).toContain('122.72');
  });
});
