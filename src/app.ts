import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import { healthRoutes } from './modules/health/health.routes.js';
import { orderRoutes } from './modules/orders/order.routes.js';
import { paymentRoutes } from './modules/payments/payment.routes.js';
import { productRoutes } from './modules/products/product.routes.js';
import { AppError } from './shared/errors/app-error.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: true,
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dados inválidos na requisição',
        issues: error.flatten().fieldErrors,
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno do servidor',
    });
  });

  app.register(healthRoutes);
  app.register(productRoutes);
  app.register(orderRoutes);
  app.register(paymentRoutes);

  return app;
}
