export type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

export type PaymentIntentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  payerEmail?: string;
  description: string;
}

export interface PaymentIntentResult {
  provider: 'mock' | 'mercadopago';
  externalPaymentId: string;
  status: PaymentIntentStatus;
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  ticketUrl?: string;
}

export interface PaymentProvider {
  readonly name: 'mock' | 'mercadopago';
  createPayment(input: CreatePaymentInput): Promise<PaymentIntentResult>;
  getPaymentStatus(externalPaymentId: string): Promise<{
    orderId?: string;
    status: PaymentIntentStatus;
  }>;
}
