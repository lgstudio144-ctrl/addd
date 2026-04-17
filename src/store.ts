import { randomUUID } from 'crypto';

export type Location = 'stock' | 'bar' | 'kitchen' | 'transit' | 'delivered';

export interface Product {
  id: string;
  barcode: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface PlacementEvent {
  id: string;
  productId: string;
  location: Location;
  note: string;
  timestamp: string;
}

// ── Auth / Users ─────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'staff';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

// ── Stock ─────────────────────────────────────────────────────────────────────

export interface StockEvent {
  id: string;
  productId: string;
  tenantId: string;
  /** Positive = stock in, negative = stock out */
  delta: number;
  reason: string;
  timestamp: string;
}

// ── Orders & Payments ─────────────────────────────────────────────────────────

export type OrderStatus = 'pending' | 'paid' | 'cancelled';

export interface OrderItem {
  productId: string;
  quantity: number;
  /** Unit price in cents (e.g. 1099 = €10.99) */
  unitPriceCents: number;
}

export interface Order {
  id: string;
  tenantId: string;
  items: OrderItem[];
  /** Total in cents */
  totalCents: number;
  status: OrderStatus;
  createdAt: string;
}

export type PaymentMethod = 'card' | 'cash' | 'bank_transfer';
export type PaymentStatus = 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  orderId: string;
  tenantId: string;
  /** Amount in cents */
  amountCents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  /** Provider reference / receipt number */
  reference: string;
  timestamp: string;
}

// ── In-memory collections ─────────────────────────────────────────────────────

const products = new Map<string, Product>();
const placements: PlacementEvent[] = [];
const users = new Map<string, User>();
const stockEvents: StockEvent[] = [];
const orders = new Map<string, Order>();
const payments: Payment[] = [];

// ── Store ─────────────────────────────────────────────────────────────────────

export const store = {
  /* ── Products ──────────────────────────────────────────────── */

  createProduct(barcode: string, name: string, description = ''): Product {
    const product: Product = {
      id: randomUUID(),
      barcode,
      name,
      description,
      createdAt: new Date().toISOString(),
    };
    products.set(product.id, product);
    return product;
  },

  listProducts(): Product[] {
    return Array.from(products.values());
  },

  getProductById(id: string): Product | undefined {
    return products.get(id);
  },

  getProductByBarcode(barcode: string): Product | undefined {
    for (const p of products.values()) {
      if (p.barcode === barcode) return p;
    }
    return undefined;
  },

  /* ── Placement / Trace ─────────────────────────────────────── */

  recordPlacement(productId: string, location: Location, note = ''): PlacementEvent {
    const event: PlacementEvent = {
      id: randomUUID(),
      productId,
      location,
      note,
      timestamp: new Date().toISOString(),
    };
    placements.push(event);
    return event;
  },

  getTrace(productId: string): PlacementEvent[] {
    return placements.filter((e) => e.productId === productId);
  },

  currentLocation(productId: string): Location | null {
    const events = placements.filter((e) => e.productId === productId);
    return events.length > 0 ? events[events.length - 1].location : null;
  },

  /* ── Users ─────────────────────────────────────────────────── */

  createUser(
    tenantId: string,
    email: string,
    passwordHash: string,
    role: UserRole = 'staff',
  ): User {
    const user: User = {
      id: randomUUID(),
      tenantId,
      email,
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
    };
    users.set(user.id, user);
    return user;
  },

  getUserById(id: string): User | undefined {
    return users.get(id);
  },

  getUserByEmail(email: string): User | undefined {
    for (const u of users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return undefined;
  },

  /* ── Stock ─────────────────────────────────────────────────── */

  adjustStock(productId: string, tenantId: string, delta: number, reason = ''): StockEvent {
    const event: StockEvent = {
      id: randomUUID(),
      productId,
      tenantId,
      delta,
      reason,
      timestamp: new Date().toISOString(),
    };
    stockEvents.push(event);
    return event;
  },

  /** Current quantity on hand for a product within a tenant. */
  stockLevel(productId: string, tenantId: string): number {
    return stockEvents
      .filter((e) => e.productId === productId && e.tenantId === tenantId)
      .reduce((sum, e) => sum + e.delta, 0);
  },

  /** All products' stock levels for a tenant. */
  stockLevels(tenantId: string): { productId: string; quantity: number }[] {
    const map = new Map<string, number>();
    for (const e of stockEvents) {
      if (e.tenantId !== tenantId) continue;
      map.set(e.productId, (map.get(e.productId) ?? 0) + e.delta);
    }
    return Array.from(map.entries()).map(([productId, quantity]) => ({ productId, quantity }));
  },

  stockHistory(productId: string, tenantId: string): StockEvent[] {
    return stockEvents.filter((e) => e.productId === productId && e.tenantId === tenantId);
  },

  /* ── Orders ─────────────────────────────────────────────────── */

  createOrder(tenantId: string, items: OrderItem[], totalCents: number): Order {
    const order: Order = {
      id: randomUUID(),
      tenantId,
      items,
      totalCents,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    orders.set(order.id, order);
    return order;
  },

  getOrder(id: string, tenantId: string): Order | undefined {
    const order = orders.get(id);
    return order?.tenantId === tenantId ? order : undefined;
  },

  listOrders(tenantId: string): Order[] {
    return Array.from(orders.values()).filter((o) => o.tenantId === tenantId);
  },

  updateOrderStatus(id: string, tenantId: string, status: OrderStatus): Order | undefined {
    const order = orders.get(id);
    if (!order || order.tenantId !== tenantId) return undefined;
    order.status = status;
    return order;
  },

  /* ── Payments ───────────────────────────────────────────────── */

  recordPayment(
    orderId: string,
    tenantId: string,
    amountCents: number,
    method: PaymentMethod,
    reference = '',
    status: PaymentStatus = 'completed',
  ): Payment {
    const payment: Payment = {
      id: randomUUID(),
      orderId,
      tenantId,
      amountCents,
      method,
      status,
      reference,
      timestamp: new Date().toISOString(),
    };
    payments.push(payment);
    return payment;
  },

  getPaymentsForOrder(orderId: string, tenantId: string): Payment[] {
    return payments.filter((p) => p.orderId === orderId && p.tenantId === tenantId);
  },

  /* ── Test helpers ──────────────────────────────────────────── */
  _clear() {
    products.clear();
    placements.length = 0;
    users.clear();
    stockEvents.length = 0;
    orders.clear();
    payments.length = 0;
  },
};
