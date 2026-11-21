import type { FastifyInstance } from 'fastify';

import { env } from '../../config/env.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    return {
      name: 'ShopeGo Back-End Mobile API',
      status: 'ok',
      paymentProvider: env.PAYMENT_PROVIDER,
      endpoints: [
        'GET /health',
        'GET /products',
        'GET /products/:id',
        'POST /orders',
        'GET /orders',
        'GET /orders/:id/tracking',
        'PATCH /orders/:id/cancel',
        'POST /payments/simulate/:orderId',
        'POST /payments/webhook',
      ],
    };
  });

  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'shopego-backend-mobile',
      paymentProvider: env.PAYMENT_PROVIDER,
      timestamp: new Date().toISOString(),
    };
  });
}
