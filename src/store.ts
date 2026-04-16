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

const products = new Map<string, Product>();
const placements: PlacementEvent[] = [];

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

  /* ── Test helpers ──────────────────────────────────────────── */
  _clear() {
    products.clear();
    placements.length = 0;
  },
};
