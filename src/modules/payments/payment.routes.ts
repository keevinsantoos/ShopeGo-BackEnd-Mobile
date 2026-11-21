import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { authenticate } from '../../middlewares/auth.middleware.js';
import { BadRequestError } from '../../shared/errors/app-error.js';
import { processPaymentUpdate } from '../orders/order.service.js';
import { createPaymentProvider } from './payment.factory.js';

const mercadoPagoWebhookSchema = z.object({
  type: z.string().optional(),
  data: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
});

const simulatePaymentSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled']),
});

const simulateParamsSchema = z.object({
  orderId: z.string().min(1),
});

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Webhook público para notificações do Mercado Pago.
   */
  app.post('/payments/webhook', async (request, reply) => {
    const payload = mercadoPagoWebhookSchema.parse(request.body ?? {});

    if (payload.type === 'payment' && payload.data?.id) {
      const provider = createPaymentProvider();
      const paymentInfo = await provider.getPaymentStatus(String(payload.data.id));
      if (paymentInfo.orderId) {
        await processPaymentUpdate(paymentInfo.orderId, paymentInfo.status);
      }
    }

    return reply.status(200).send({ received: true });
  });

  /**
   * Endpoint auxiliar para simular aprovação/recusa de pagamento em ambiente de dev/testes.
   */
  app.post(
    '/payments/simulate/:orderId',
    { preHandler: [authenticate] },
    async (request) => {
      const { orderId } = simulateParamsSchema.parse(request.params);
      const { status } = simulatePaymentSchema.parse(request.body);

      if (createPaymentProvider().name !== 'mock') {
        throw new BadRequestError(
          'Simulação disponível apenas quando PAYMENT_PROVIDER=mock',
          'SIMULATION_DISABLED',
        );
      }

      return processPaymentUpdate(orderId, status);
    },
  );
}
