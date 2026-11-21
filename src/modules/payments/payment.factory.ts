import { env } from '../../config/env.js';
import { MercadoPagoProvider } from './mercadopago.provider.js';
import { MockPaymentProvider } from './mock.provider.js';
import type { PaymentProvider } from './payment.types.js';

export function createPaymentProvider(): PaymentProvider {
  if (env.PAYMENT_PROVIDER === 'mercadopago') {
    if (!env.MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error(
        'MERCADOPAGO_ACCESS_TOKEN é obrigatório quando PAYMENT_PROVIDER=mercadopago',
      );
    }
    return new MercadoPagoProvider(env.MERCADOPAGO_ACCESS_TOKEN);
  }

  return new MockPaymentProvider();
}
