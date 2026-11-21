import { z } from 'zod';

/**
 * Status alinhado com `src/features/orders/types/order.ts` do Front-end.
 */
export const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
]);

export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const paymentMethodSchema = z.enum(['pix', 'credit_card', 'boleto']);

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  imageUrl: z.string(),
});

export type OrderItem = z.infer<typeof orderItemSchema>;

export const trackingEventSchema = z.object({
  status: orderStatusSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  timestamp: z.string(),
});

export type TrackingEvent = z.infer<typeof trackingEventSchema>;

export const createOrderBodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, 'O pedido deve conter ao menos 1 item'),
  shippingAddress: z.string().min(5, 'Endereço de entrega inválido'),
  paymentMethod: paymentMethodSchema,
});

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;

export const orderIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const updateOrderStatusBodySchema = z.object({
  status: orderStatusSchema,
  note: z.string().optional(),
});
