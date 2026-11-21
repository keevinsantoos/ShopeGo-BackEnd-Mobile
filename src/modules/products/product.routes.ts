import type { FastifyInstance } from 'fastify';

import { authenticate } from '../../middlewares/auth.middleware.js';
import { listProductsQuerySchema, productIdParamsSchema } from './product.schema.js';
import { getProductById, listProducts, seedProducts } from './product.service.js';

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.get('/products', async (request) => {
    const query = listProductsQuerySchema.parse(request.query);
    const items = await listProducts(query);
    return { items, total: items.length };
  });

  app.get('/products/:id', async (request) => {
    const { id } = productIdParamsSchema.parse(request.params);
    return getProductById(id);
  });

  app.post('/products/seed', { preHandler: [authenticate] }, async () => {
    return seedProducts();
  });
}
