import { describe, expect, it } from 'vitest';

import {
  calculateCheckoutTotals,
  calculateDiscountedPrice,
  roundCurrency,
} from '../src/shared/utils/pricing.js';

describe('Pricing business rules', () => {
  it('arredonda valores monetários corretamente', () => {
    expect(roundCurrency(19.999)).toBe(20);
    expect(roundCurrency(59.9 * 0.9)).toBe(53.91);
  });

  it('aplica desconto percentual dentro dos limites 0-100', () => {
    expect(calculateDiscountedPrice(100, 15)).toBe(85);
    expect(calculateDiscountedPrice(59.9, 10)).toBe(53.91);
    expect(calculateDiscountedPrice(100, 0)).toBe(100);
    expect(calculateDiscountedPrice(100, 150)).toBe(0);
  });

  it('cobra frete padrão abaixo de R$ 199,00', () => {
    const totals = calculateCheckoutTotals([{ unitPrice: 53.91, quantity: 2 }]);
    expect(totals.subtotal).toBe(107.82);
    expect(totals.shippingFee).toBe(14.9);
    expect(totals.total).toBe(122.72);
  });

  it('concede frete grátis a partir de R$ 199,00', () => {
    const totals = calculateCheckoutTotals([{ unitPrice: 100, quantity: 2 }]);
    expect(totals.subtotal).toBe(200);
    expect(totals.shippingFee).toBe(0);
    expect(totals.total).toBe(200);
  });
});
