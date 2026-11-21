import { describe, expect, it } from 'vitest';

import {
  assertValidStatusTransition,
  canCancelOrder,
  canTransitionOrderStatus,
  getDefaultTrackingTitle,
} from '../src/modules/orders/order.rules.js';
import { ConflictError } from '../src/shared/errors/app-error.js';

describe('Order status & cancellation rules', () => {
  it('permite transições válidas do ciclo de vida do pedido', () => {
    expect(canTransitionOrderStatus('pending', 'confirmed')).toBe(true);
    expect(canTransitionOrderStatus('confirmed', 'shipped')).toBe(true);
    expect(canTransitionOrderStatus('shipped', 'delivered')).toBe(true);
    expect(canTransitionOrderStatus('pending', 'cancelled')).toBe(true);
  });

  it('bloqueia transições inválidas ou retrocessos', () => {
    expect(canTransitionOrderStatus('pending', 'delivered')).toBe(false);
    expect(canTransitionOrderStatus('delivered', 'cancelled')).toBe(false);
    expect(canTransitionOrderStatus('cancelled', 'confirmed')).toBe(false);

    expect(() => assertValidStatusTransition('pending', 'delivered')).toThrow(ConflictError);
  });

  it('permite cancelamento apenas em pending ou confirmed', () => {
    expect(canCancelOrder('pending')).toBe(true);
    expect(canCancelOrder('confirmed')).toBe(true);
    expect(canCancelOrder('shipped')).toBe(false);
    expect(canCancelOrder('delivered')).toBe(false);
    expect(canCancelOrder('cancelled')).toBe(false);
  });

  it('retorna títulos amigáveis de rastreamento para cada status', () => {
    expect(getDefaultTrackingTitle('pending')).toContain('aguardando');
    expect(getDefaultTrackingTitle('confirmed')).toContain('aprovado');
    expect(getDefaultTrackingTitle('delivered')).toContain('entregue');
  });
});
