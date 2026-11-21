import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  CreatePaymentInput,
  PaymentIntentResult,
  PaymentIntentStatus,
  PaymentProvider,
} from './payment.types.js';

interface MercadoPagoPaymentResponse {
  id: number;
  status: string;
  external_reference?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
}

function mapMercadoPagoStatus(mpStatus: string): PaymentIntentStatus {
  switch (mpStatus) {
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'cancelled':
    case 'refunded':
    case 'charged_back':
      return 'cancelled';
    default:
      return 'pending';
  }
}

export class MercadoPagoProvider implements PaymentProvider {
  public readonly name = 'mercadopago' as const;
  private readonly accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentIntentResult> {
    const paymentMethodId = input.method === 'pix' ? 'pix' : 'bolbradesco';

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `shopego-${input.orderId}`,
      },
      body: JSON.stringify({
        transaction_amount: input.amount,
        description: input.description,
        payment_method_id: paymentMethodId,
        external_reference: input.orderId,
        notification_url: `${env.APP_BASE_URL}/payments/webhook`,
        payer: {
          email: input.payerEmail ?? 'comprador@shopego.local',
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new AppError(
        `Falha ao criar pagamento no Mercado Pago: ${errorBody}`,
        502,
        'PAYMENT_GATEWAY_ERROR',
      );
    }

    const data = (await response.json()) as MercadoPagoPaymentResponse;
    const txData = data.point_of_interaction?.transaction_data;

    return {
      provider: 'mercadopago',
      externalPaymentId: String(data.id),
      status: mapMercadoPagoStatus(data.status),
      pixQrCode: txData?.qr_code,
      pixQrCodeBase64: txData?.qr_code_base64,
      ticketUrl: txData?.ticket_url,
    };
  }

  async getPaymentStatus(externalPaymentId: string): Promise<{
    orderId?: string;
    status: PaymentIntentStatus;
  }> {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${externalPaymentId}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new AppError(
        'Não foi possível consultar pagamento no Mercado Pago',
        502,
        'PAYMENT_GATEWAY_ERROR',
      );
    }

    const data = (await response.json()) as MercadoPagoPaymentResponse;
    return {
      orderId: data.external_reference,
      status: mapMercadoPagoStatus(data.status),
    };
  }
}
