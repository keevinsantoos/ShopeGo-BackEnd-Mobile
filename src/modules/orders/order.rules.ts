import { BadRequestError, ConflictError } from '../../shared/errors/app-error.js';
import type { OrderStatus } from './order.schema.js';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const CANCELLABLE_STATUSES: ReadonlySet<OrderStatus> = new Set(['pending', 'confirmed']);

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertValidStatusTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === to) {
    throw new BadRequestError(`O pedido já está com status "${to}"`, 'SAME_STATUS');
  }
  if (!canTransitionOrderStatus(from, to)) {
    throw new ConflictError(
      `Transição de status inválida: "${from}" -> "${to}"`,
      'INVALID_STATUS_TRANSITION',
    );
  }
}

export function canCancelOrder(status: OrderStatus): boolean {
  return CANCELLABLE_STATUSES.has(status);
}

export function getDefaultTrackingTitle(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return 'Pedido realizado — aguardando pagamento';
    case 'confirmed':
      return 'Pagamento aprovado — preparando envio';
    case 'shipped':
      return 'Pedido enviado para entrega';
    case 'delivered':
      return 'Pedido entregue';
    case 'cancelled':
      return 'Pedido cancelado';
  }
}
