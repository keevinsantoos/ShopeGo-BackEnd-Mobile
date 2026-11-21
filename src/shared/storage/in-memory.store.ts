import type { OrderRecord } from '../../modules/orders/order.service.js';
import type { Product } from '../../modules/products/product.schema.js';

export const INITIAL_PRODUCTS: Omit<Product, 'id'>[] = [
  {
    name: 'Camiseta de Pesca Masculina',
    description: 'Tecido leve com proteção UV50+ para atividades ao ar livre.',
    price: 59.9,
    imageUrl: '',
    cardColor: '#CFF5D3',
    discountPercent: 10,
    category: 'Roupas',
    stock: 25,
  },
  {
    name: 'Smartwatch Ultrassônico',
    description: 'Monitoramento cardíaco, notificações e bateria de longa duração.',
    price: 129.9,
    imageUrl: '',
    cardColor: '#E3DEFF',
    discountPercent: 30,
    category: 'Eletrônicos',
    stock: 15,
  },
  {
    name: 'Fone Bluetooth Air Pro',
    description: 'Cancelamento ativo de ruído e estojo de carregamento rápido.',
    price: 99.9,
    imageUrl: '',
    cardColor: '#E3DEFF',
    category: 'Eletrônicos',
    stock: 30,
  },
  {
    name: 'Tênis Esportivo Vermelho',
    description: 'Amortecimento leve ideal para corrida e caminhada.',
    price: 189.9,
    imageUrl: '',
    cardColor: '#FFD4D2',
    discountPercent: 15,
    category: 'Calçados',
    stock: 12,
  },
  {
    name: 'Perfume Floral Feminino',
    description: 'Fragrância suave e marcante para o dia a dia.',
    price: 79.9,
    imageUrl: '',
    cardColor: '#F5F6C2',
    category: 'Beleza',
    stock: 20,
  },
  {
    name: 'Blazer Social Premium',
    description: 'Corte moderno com acabamento alfaiataria.',
    price: 219.9,
    imageUrl: '',
    cardColor: '#CFF5D3',
    discountPercent: 20,
    category: 'Roupas',
    stock: 10,
  },
];

class InMemoryStore {
  public readonly products = new Map<string, Product>();
  public readonly orders = new Map<string, OrderRecord>();

  constructor() {
    this.seedProducts();
  }

  public seedProducts(): number {
    INITIAL_PRODUCTS.forEach((product, index) => {
      const id = String(index + 1);
      this.products.set(id, { id, ...product });
    });
    return INITIAL_PRODUCTS.length;
  }
}

export const inMemoryStore = new InMemoryStore();
