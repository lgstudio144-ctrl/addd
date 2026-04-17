import { Router } from 'express';
import type { Request, Response } from 'express';
import { store } from '../store';

const router = Router();

/**
 * GET /stock
 *
 * Returns current stock levels for all products within the authenticated
 * tenant.  Products with no stock events are not listed.
 */
router.get('/', (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 'default';
  const levels = store.stockLevels(tenantId).map((l) => ({
    ...l,
    product: store.getProductById(l.productId),
  }));
  res.json(levels);
});

/**
 * GET /stock/:productId
 *
 * Returns the current stock level and adjustment history for a single product.
 */
router.get('/:productId', (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 'default';
  const productId = String(req.params['productId'] ?? '');

  const product = store.getProductById(productId);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  res.json({
    product,
    quantity: store.stockLevel(productId, tenantId),
    history: store.stockHistory(productId, tenantId),
  });
});

/**
 * POST /stock/:productId/adjust
 *
 * Record a stock adjustment.
 * Body: { delta: number, reason?: string }
 *
 * Positive delta = stock received; negative = stock consumed / sold.
 */
router.post('/:productId/adjust', (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 'default';
  const productId = String(req.params['productId'] ?? '');

  const product = store.getProductById(productId);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const { delta, reason } = req.body as { delta?: unknown; reason?: string };

  if (typeof delta !== 'number' || !Number.isFinite(delta) || delta === 0) {
    res.status(400).json({ error: '"delta" must be a non-zero finite number' });
    return;
  }

  const newLevel = store.stockLevel(productId, tenantId) + delta;
  if (newLevel < 0) {
    res.status(422).json({
      error: 'Adjustment would result in negative stock',
      currentQuantity: store.stockLevel(productId, tenantId),
    });
    return;
  }

  const event = store.adjustStock(productId, tenantId, delta, reason ?? '');
  res.status(201).json({ event, quantity: store.stockLevel(productId, tenantId) });
});

export default router;
