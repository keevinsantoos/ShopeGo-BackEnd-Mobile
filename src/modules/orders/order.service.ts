import crypto from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { env } from '../../config/env.js';
import { getDb } from '../../config/firebase.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/app-error.js';
import { inMemoryStore } from '../../shared/storage/in-memory.store.js';
import {
  calculateCheckoutTotals,
  calculateDiscountedPrice,
} from '../../shared/utils/pricing.js';
import { createPaymentProvider } from '../payments/payment.factory.js';
import type { PaymentIntentResult, PaymentIntentStatus } from '../payments/payment.types.js';
import { productSchema } from '../products/product.schema.js';
import {
  assertValidStatusTransition,
  canCancelOrder,
  getDefaultTrackingTitle,
} from './order.rules.js';
import type {
  CreateOrderBody,
  OrderItem,
  OrderStatus,
  TrackingEvent,
} from './order.schema.js';

const ORDERS_COLLECTION = 'orders';
const PRODUCTS_COLLECTION = 'products';

export interface OrderRecord {
  id: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  status: OrderStatus;
  shippingAddress: string;
  paymentMethod: string;
  payment?: PaymentIntentResult;
  tracking: TrackingEvent[];
  createdAt?: string;
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  return typeof value === 'string' ? value : undefined;
}

function mapDocToOrder(id: string, data: Record<string, unknown>): OrderRecord {
  return {
    id,
    userId: String(data.userId ?? ''),
    items: (data.items as OrderItem[]) ?? [],
    subtotal: Number(data.subtotal ?? data.total ?? 0),
    shippingFee: Number(data.shippingFee ?? 0),
    total: Number(data.total ?? 0),
    status: (data.status as OrderStatus) ?? 'pending',
    shippingAddress: String(data.shippingAddress ?? ''),
    paymentMethod: String(data.paymentMethod ?? ''),
    payment: data.payment as PaymentIntentResult | undefined,
    tracking: (data.tracking as TrackingEvent[]) ?? [],
    createdAt: normalizeTimestamp(data.createdAt),
  };
}

/**
 * Consolida itens com o mesmo productId para evitar duplicidade na checagem de estoque.
 */
function consolidateItems(items: CreateOrderBody['items']): CreateOrderBody['items'] {
  const byProduct = new Map<string, number>();
  for (const item of items) {
    byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
  }
  return Array.from(byProduct.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

export async function createOrder(
  userId: string,
  payerEmail: string | undefined,
  input: CreateOrderBody,
): Promise<OrderRecord> {
  const requestedItems = consolidateItems(input.items);
  const nowIso = new Date().toISOString();

  let createdOrder: OrderRecord;

  if (env.USE_IN_MEMORY_DB) {
    const orderItems: OrderItem[] = [];
    const stockUpdates: Array<{ id: string; nextStock: number }> = [];

    for (const reqItem of requestedItems) {
      const product = inMemoryStore.products.get(reqItem.productId);
      if (!product) {
        throw new NotFoundError(
          `Produto "${reqItem.productId}" não encontrado`,
          'PRODUCT_NOT_FOUND',
        );
      }
      if (product.stock < reqItem.quantity) {
        throw new ConflictError(
          `Estoque insuficiente para "${product.name}". Disponível: ${product.stock}`,
          'INSUFFICIENT_STOCK',
        );
      }
      stockUpdates.push({ id: product.id, nextStock: product.stock - reqItem.quantity });
      orderItems.push({
        productId: product.id,
        name: product.name,
        unitPrice: calculateDiscountedPrice(product.price, product.discountPercent),
        quantity: reqItem.quantity,
        imageUrl: product.imageUrl,
      });
    }

    for (const upd of stockUpdates) {
      const current = inMemoryStore.products.get(upd.id)!;
      inMemoryStore.products.set(upd.id, { ...current, stock: upd.nextStock });
    }

    const totals = calculateCheckoutTotals(orderItems);
    const id = crypto.randomUUID();
    createdOrder = {
      id,
      userId,
      items: orderItems,
      subtotal: totals.subtotal,
      shippingFee: totals.shippingFee,
      total: totals.total,
      status: 'pending',
      shippingAddress: input.shippingAddress,
      paymentMethod: input.paymentMethod,
      tracking: [
        {
          status: 'pending',
          title: getDefaultTrackingTitle('pending'),
          timestamp: nowIso,
        },
      ],
      createdAt: nowIso,
    };
    inMemoryStore.orders.set(id, createdOrder);
  } else {
    const db = getDb();
    const orderRef = db.collection(ORDERS_COLLECTION).doc();

    createdOrder = await db.runTransaction(async (tx) => {
      const orderItems: OrderItem[] = [];

      for (const reqItem of requestedItems) {
        const productRef = db.collection(PRODUCTS_COLLECTION).doc(reqItem.productId);
        const productSnap = await tx.get(productRef);

        if (!productSnap.exists) {
          throw new NotFoundError(
            `Produto "${reqItem.productId}" não encontrado`,
            'PRODUCT_NOT_FOUND',
          );
        }

        const product = productSchema.parse({ id: productSnap.id, ...productSnap.data() });

        if (product.stock < reqItem.quantity) {
          throw new ConflictError(
            `Estoque insuficiente para "${product.name}". Disponível: ${product.stock}`,
            'INSUFFICIENT_STOCK',
          );
        }

        tx.update(productRef, {
          stock: product.stock - reqItem.quantity,
        });

        orderItems.push({
          productId: product.id,
          name: product.name,
          unitPrice: calculateDiscountedPrice(product.price, product.discountPercent),
          quantity: reqItem.quantity,
          imageUrl: product.imageUrl,
        });
      }

      const totals = calculateCheckoutTotals(orderItems);
      const tracking: TrackingEvent[] = [
        {
          status: 'pending',
          title: getDefaultTrackingTitle('pending'),
          timestamp: nowIso,
        },
      ];

      const payload = {
        userId,
        items: orderItems,
        subtotal: totals.subtotal,
        shippingFee: totals.shippingFee,
        total: totals.total,
        status: 'pending' as OrderStatus,
        shippingAddress: input.shippingAddress,
        paymentMethod: input.paymentMethod,
        tracking,
        createdAt: FieldValue.serverTimestamp(),
      };

      tx.set(orderRef, payload);

      return {
        id: orderRef.id,
        ...payload,
        createdAt: nowIso,
      };
    });
  }

  // Gera cobrança no gateway de pagamento fora da transação do Firestore
  try {
    const paymentProvider = createPaymentProvider();
    const paymentResult = await paymentProvider.createPayment({
      orderId: createdOrder.id,
      amount: createdOrder.total,
      method: input.paymentMethod,
      payerEmail,
      description: `Pedido ShopGo #${createdOrder.id.slice(0, 8)}`,
    });

    if (env.USE_IN_MEMORY_DB) {
      const updated = { ...createdOrder, payment: paymentResult };
      inMemoryStore.orders.set(createdOrder.id, updated);
      return updated;
    }

    await getDb().collection(ORDERS_COLLECTION).doc(createdOrder.id).update({
      payment: paymentResult,
    });

    return {
      ...createdOrder,
      payment: paymentResult,
    };
  } catch (error) {
    await restoreOrderStockAndCancel(createdOrder.id, 'Falha ao iniciar pagamento').catch(
      () => undefined,
    );
    throw error;
  }
}

export async function listUserOrders(userId: string): Promise<OrderRecord[]> {
  if (env.USE_IN_MEMORY_DB) {
    return Array.from(inMemoryStore.orders.values())
      .filter((o) => o.userId === userId)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }

  const snapshot = await getDb()
    .collection(ORDERS_COLLECTION)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => mapDocToOrder(doc.id, doc.data()));
}

export async function getOrderById(orderId: string, userId: string): Promise<OrderRecord> {
  if (env.USE_IN_MEMORY_DB) {
    const order = inMemoryStore.orders.get(orderId);
    if (!order) {
      throw new NotFoundError('Pedido não encontrado', 'ORDER_NOT_FOUND');
    }
    if (order.userId !== userId) {
      throw new ForbiddenError('Você não tem permissão para acessar este pedido');
    }
    return order;
  }

  const doc = await getDb().collection(ORDERS_COLLECTION).doc(orderId).get();
  if (!doc.exists) {
    throw new NotFoundError('Pedido não encontrado', 'ORDER_NOT_FOUND');
  }

  const order = mapDocToOrder(doc.id, doc.data() ?? {});
  if (order.userId !== userId) {
    throw new ForbiddenError('Você não tem permissão para acessar este pedido');
  }

  return order;
}

async function restoreOrderStockAndCancel(orderId: string, reason?: string): Promise<OrderRecord> {
  if (env.USE_IN_MEMORY_DB) {
    const order = inMemoryStore.orders.get(orderId);
    if (!order) {
      throw new NotFoundError('Pedido não encontrado', 'ORDER_NOT_FOUND');
    }
    if (!canCancelOrder(order.status)) {
      throw new ConflictError(
        `Pedido com status "${order.status}" não pode ser cancelado`,
        'ORDER_CANNOT_BE_CANCELLED',
      );
    }

    for (const item of order.items) {
      const product = inMemoryStore.products.get(item.productId);
      if (product) {
        inMemoryStore.products.set(item.productId, {
          ...product,
          stock: product.stock + item.quantity,
        });
      }
    }

    const updated: OrderRecord = {
      ...order,
      status: 'cancelled',
      tracking: [
        ...order.tracking,
        {
          status: 'cancelled',
          title: getDefaultTrackingTitle('cancelled'),
          description: reason,
          timestamp: new Date().toISOString(),
        },
      ],
    };
    inMemoryStore.orders.set(orderId, updated);
    return updated;
  }

  const db = getDb();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);

  return db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) {
      throw new NotFoundError('Pedido não encontrado', 'ORDER_NOT_FOUND');
    }

    const order = mapDocToOrder(orderSnap.id, orderSnap.data() ?? {});
    if (!canCancelOrder(order.status)) {
      throw new ConflictError(
        `Pedido com status "${order.status}" não pode ser cancelado`,
        'ORDER_CANNOT_BE_CANCELLED',
      );
    }

    for (const item of order.items) {
      const productRef = db.collection(PRODUCTS_COLLECTION).doc(item.productId);
      const productSnap = await tx.get(productRef);
      if (productSnap.exists) {
        const currentStock = Number(productSnap.data()?.stock ?? 0);
        tx.update(productRef, { stock: currentStock + item.quantity });
      }
    }

    const event: TrackingEvent = {
      status: 'cancelled',
      title: getDefaultTrackingTitle('cancelled'),
      description: reason,
      timestamp: new Date().toISOString(),
    };

    const updatedTracking = [...order.tracking, event];
    tx.update(orderRef, {
      status: 'cancelled',
      tracking: updatedTracking,
    });

    return {
      ...order,
      status: 'cancelled',
      tracking: updatedTracking,
    };
  });
}

export async function cancelOrder(orderId: string, userId: string): Promise<OrderRecord> {
  const existing = await getOrderById(orderId, userId);
  if (!canCancelOrder(existing.status)) {
    throw new ConflictError(
      `Pedido com status "${existing.status}" não pode ser cancelado`,
      'ORDER_CANNOT_BE_CANCELLED',
    );
  }
  return restoreOrderStockAndCancel(orderId, 'Cancelado pelo cliente');
}

export async function updateOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
  note?: string,
): Promise<OrderRecord> {
  if (nextStatus === 'cancelled') {
    return restoreOrderStockAndCancel(orderId, note ?? 'Cancelado pelo sistema');
  }

  if (env.USE_IN_MEMORY_DB) {
    const order = inMemoryStore.orders.get(orderId);
    if (!order) {
      throw new NotFoundError('Pedido não encontrado', 'ORDER_NOT_FOUND');
    }
    assertValidStatusTransition(order.status, nextStatus);

    const updated: OrderRecord = {
      ...order,
      status: nextStatus,
      tracking: [
        ...order.tracking,
        {
          status: nextStatus,
          title: getDefaultTrackingTitle(nextStatus),
          description: note,
          timestamp: new Date().toISOString(),
        },
      ],
    };
    inMemoryStore.orders.set(orderId, updated);
    return updated;
  }

  const db = getDb();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) {
      throw new NotFoundError('Pedido não encontrado', 'ORDER_NOT_FOUND');
    }

    const order = mapDocToOrder(snap.id, snap.data() ?? {});
    assertValidStatusTransition(order.status, nextStatus);

    const event: TrackingEvent = {
      status: nextStatus,
      title: getDefaultTrackingTitle(nextStatus),
      description: note,
      timestamp: new Date().toISOString(),
    };

    const updatedTracking = [...order.tracking, event];
    tx.update(orderRef, {
      status: nextStatus,
      tracking: updatedTracking,
    });

    return {
      ...order,
      status: nextStatus,
      tracking: updatedTracking,
    };
  });
}

export async function processPaymentUpdate(
  orderId: string,
  paymentStatus: PaymentIntentStatus,
): Promise<OrderRecord> {
  let order: OrderRecord;

  if (env.USE_IN_MEMORY_DB) {
    const existing = inMemoryStore.orders.get(orderId);
    if (!existing) {
      throw new NotFoundError('Pedido não encontrado', 'ORDER_NOT_FOUND');
    }
    order = existing.payment
      ? { ...existing, payment: { ...existing.payment, status: paymentStatus } }
      : existing;
    inMemoryStore.orders.set(orderId, order);
  } else {
    const db = getDb();
    const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
    const snap = await orderRef.get();

    if (!snap.exists) {
      throw new NotFoundError('Pedido não encontrado', 'ORDER_NOT_FOUND');
    }

    order = mapDocToOrder(snap.id, snap.data() ?? {});

    if (order.payment) {
      await orderRef.update({
        'payment.status': paymentStatus,
      });
    }
  }

  if (paymentStatus === 'approved' && order.status === 'pending') {
    return updateOrderStatus(orderId, 'confirmed', 'Pagamento confirmado pelo gateway');
  }

  if ((paymentStatus === 'rejected' || paymentStatus === 'cancelled') && order.status === 'pending') {
    return restoreOrderStockAndCancel(orderId, `Pagamento ${paymentStatus}`);
  }

  if (paymentStatus === 'pending') {
    throw new BadRequestError('Pagamento ainda está pendente', 'PAYMENT_PENDING');
  }

  return order;
}
