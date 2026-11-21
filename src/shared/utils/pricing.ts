/**
 * Arredonda valores monetários para 2 casas decimais evitando erros de ponto flutuante.
 */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula o preço unitário final aplicando o desconto percentual (0-100).
 */
export function calculateDiscountedPrice(price: number, discountPercent = 0): number {
  if (price < 0) {
    throw new Error('Preço não pode ser negativo');
  }
  const clampedDiscount = Math.min(100, Math.max(0, discountPercent));
  const finalPrice = price * (1 - clampedDiscount / 100);
  return roundCurrency(finalPrice);
}

export interface PricedLineItem {
  unitPrice: number;
  quantity: number;
}

export interface CheckoutTotals {
  subtotal: number;
  shippingFee: number;
  total: number;
}

const FREE_SHIPPING_THRESHOLD = 199;
const STANDARD_SHIPPING_FEE = 14.9;

/**
 * Calcula subtotal, frete (grátis acima de R$ 199,00) e total do pedido.
 */
export function calculateCheckoutTotals(items: PricedLineItem[]): CheckoutTotals {
  const subtotal = roundCurrency(
    items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  );
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : STANDARD_SHIPPING_FEE;
  const total = roundCurrency(subtotal + shippingFee);

  return { subtotal, shippingFee, total };
}
