import { z } from 'zod';

/**
 * Schema alinhado com `src/features/products/types/product.ts` do Front-end.
 */
export const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  imageUrl: z.string(),
  cardColor: z.string().min(1),
  discountPercent: z.number().min(0).max(100).optional(),
  category: z.string().optional(),
  stock: z.number().int().nonnegative().default(0),
});

export type Product = z.infer<typeof productSchema>;

export const listProductsQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  onlyOffers: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const productIdParamsSchema = z.object({
  id: z.string().min(1),
});
