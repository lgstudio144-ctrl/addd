import { Router } from 'express';
import type { Request, Response } from 'express';
import { store } from '../store';
import type { Location } from '../store';

const router = Router();

const VALID_LOCATIONS: Location[] = ['stock', 'bar', 'kitchen', 'transit', 'delivered'];

/**
 * GET /products
 * List all registered products.
 */
router.get('/', (_req: Request, res: Response) => {
  const products = store.listProducts().map((p) => ({
    ...p,
    currentLocation: store.currentLocation(p.id),
  }));
  res.json(products);
});

/**
 * POST /products
 * Register a new product.
 * Body: { barcode, name, description? }
 */
router.post('/', (req: Request, res: Response) => {
  const { barcode, name, description } = req.body as {
    barcode?: string;
    name?: string;
    description?: string;
  };

  if (!barcode || !name) {
    res.status(400).json({ error: 'barcode and name are required' });
    return;
  }

  if (store.getProductByBarcode(barcode)) {
    res.status(409).json({ error: 'A product with this barcode already exists' });
    return;
  }

  const product = store.createProduct(barcode, name, description);
  res.status(201).json(product);
});

/**
 * GET /products/:id
 * Get a product by ID including its current location.
 */
router.get('/:id', (req: Request, res: Response) => {
  const product = store.getProductById(String(req.params['id'] ?? ''));
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json({ ...product, currentLocation: store.currentLocation(product.id) });
});

/**
 * POST /products/:id/placement
 * Record a placement event for the product.
 * Body: { location: 'stock'|'bar'|'kitchen'|'transit'|'delivered', note? }
 */
router.post('/:id/placement', (req: Request, res: Response) => {
  const product = store.getProductById(String(req.params['id'] ?? ''));
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const { location, note } = req.body as { location?: string; note?: string };

  if (!location || !VALID_LOCATIONS.includes(location as Location)) {
    res.status(400).json({ error: `location must be one of: ${VALID_LOCATIONS.join(', ')}` });
    return;
  }

  const event = store.recordPlacement(product.id, location as Location, note);
  res.status(201).json(event);
});

/**
 * GET /products/:id/trace
 * Get the full placement history (track & trace) for a product.
 */
router.get('/:id/trace', (req: Request, res: Response) => {
  const product = store.getProductById(String(req.params['id'] ?? ''));
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json({
    product,
    currentLocation: store.currentLocation(product.id),
    history: store.getTrace(product.id),
  });
});

export default router;
