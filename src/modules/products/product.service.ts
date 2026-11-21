import { env } from '../../config/env.js';
import { getDb } from '../../config/firebase.js';
import { NotFoundError } from '../../shared/errors/app-error.js';
import { INITIAL_PRODUCTS, inMemoryStore } from '../../shared/storage/in-memory.store.js';
import { calculateDiscountedPrice } from '../../shared/utils/pricing.js';
import { productSchema, type ListProductsQuery, type Product } from './product.schema.js';

const PRODUCTS_COLLECTION = 'products';

export interface ProductWithFinalPrice extends Product {
  finalPrice: number;
}

function enrichProduct(raw: Record<string, unknown>, id: string): ProductWithFinalPrice {
  const product = productSchema.parse({ id, ...raw });
  return {
    ...product,
    finalPrice: calculateDiscountedPrice(product.price, product.discountPercent),
  };
}

export async function listProducts(query: ListProductsQuery): Promise<ProductWithFinalPrice[]> {
  let items: ProductWithFinalPrice[];

  if (env.USE_IN_MEMORY_DB) {
    items = Array.from(inMemoryStore.products.values()).map((p) => enrichProduct(p, p.id));
  } else {
    const snapshot = await getDb().collection(PRODUCTS_COLLECTION).get();
    items = snapshot.docs.map((doc) => enrichProduct(doc.data(), doc.id));
  }

  if (query.category) {
    const categoryLower = query.category.toLowerCase();
    items = items.filter((item) => item.category?.toLowerCase() === categoryLower);
  }

  if (query.onlyOffers) {
    items = items.filter((item) => (item.discountPercent ?? 0) > 0);
  }

  if (query.search) {
    const term = query.search.toLowerCase();
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        (item.description?.toLowerCase().includes(term) ?? false),
    );
  }

  return items;
}

export async function getProductById(productId: string): Promise<ProductWithFinalPrice> {
  if (env.USE_IN_MEMORY_DB) {
    const product = inMemoryStore.products.get(productId);
    if (!product) {
      throw new NotFoundError('Produto não encontrado', 'PRODUCT_NOT_FOUND');
    }
    return enrichProduct(product, product.id);
  }

  const doc = await getDb().collection(PRODUCTS_COLLECTION).doc(productId).get();
  if (!doc.exists) {
    throw new NotFoundError('Produto não encontrado', 'PRODUCT_NOT_FOUND');
  }
  return enrichProduct(doc.data() ?? {}, doc.id);
}

/**
 * Popula o Firestore (ou o store em memória) com os produtos iniciais alinhados ao mock do Front-end.
 */
export async function seedProducts(): Promise<{ seeded: number }> {
  if (env.USE_IN_MEMORY_DB) {
    return { seeded: inMemoryStore.seedProducts() };
  }

  const db = getDb();
  const batch = db.batch();

  INITIAL_PRODUCTS.forEach((product, index) => {
    const ref = db.collection(PRODUCTS_COLLECTION).doc(String(index + 1));
    batch.set(ref, product, { merge: true });
  });

  await batch.commit();
  return { seeded: INITIAL_PRODUCTS.length };
}
