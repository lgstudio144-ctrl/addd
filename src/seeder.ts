import { store } from './store';
import type { CatalogEntry } from './seeds/spaas';

/**
 * Idempotent store seeder.
 *
 * Iterates over the provided catalog and registers each entry as a product.
 * Entries whose barcode is already present in the store are silently skipped,
 * so the function is safe to call more than once (e.g. across warm CF Worker
 * instances where the module-level store already contains data).
 */
export function seedStore(catalog: CatalogEntry[]): void {
  for (const entry of catalog) {
    if (!store.getProductByBarcode(entry.barcode)) {
      store.createProduct(entry.barcode, entry.name, entry.description);
    }
  }
}
