import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../middlewares/auth.middleware.js';
import {
  createOrderBodySchema,
  orderIdParamsSchema,
  updateOrderStatusBodySchema,
} from './order.schema.js';
import {
  cancelOrder,
  createOrder,
  getOrderById,
  listUserOrders,
  updateOrderStatus,
} from './order.service.js';

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.post('/orders', async (request, reply) => {
    const body = createOrderBodySchema.parse(request.body);
    const order = await createOrder(request.user!.uid, request.user?.email, body);
    return reply.status(201).send(order);
  });

  app.get('/orders', async (request) => {
    const orders = await listUserOrders(request.user!.uid);
    return { items: orders, total: orders.length };
  });

  app.get('/orders/:id', async (request) => {
    const { id } = orderIdParamsSchema.parse(request.params);
    return getOrderById(id, request.user!.uid);
  });

  app.get('/orders/:id/tracking', async (request) => {
    const { id } = orderIdParamsSchema.parse(request.params);
    const order = await getOrderById(id, request.user!.uid);
    return {
      orderId: order.id,
      status: order.status,
      tracking: order.tracking,
    };
  });

  app.patch('/orders/:id/cancel', async (request) => {
    const { id } = orderIdParamsSchema.parse(request.params);
    return cancelOrder(id, request.user!.uid);
  });

  app.patch('/orders/:id/status', async (request) => {
    const { id } = orderIdParamsSchema.parse(request.params);
    const { status, note } = updateOrderStatusBodySchema.parse(request.body);
    return updateOrderStatus(id, status, note);
  });
}
