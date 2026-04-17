import { Router } from 'express';
import type { Request, Response } from 'express';
import { store } from '../store';
import type { OrderItem } from '../store';

const router = Router();

/**
 * POST /orders
 *
 * Create a new order.
 * Body: { items: [{ productId, quantity, unitPriceCents }] }
 *
 * Each item's quantity is deducted from stock.  If any product has
 * insufficient stock the request is rejected with 422.
 */
router.post('/', (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 'default';

  const { items } = req.body as { items?: unknown };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: '"items" must be a non-empty array' });
    return;
  }

  // Validate each item
  const validated: OrderItem[] = [];
  for (const item of items) {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as Record<string, unknown>)['productId'] !== 'string' ||
      typeof (item as Record<string, unknown>)['quantity'] !== 'number' ||
      typeof (item as Record<string, unknown>)['unitPriceCents'] !== 'number'
    ) {
      res.status(400).json({
        error: 'Each item must have productId (string), quantity (number), unitPriceCents (number)',
      });
      return;
    }
    const { productId, quantity, unitPriceCents } = item as {
      productId: string;
      quantity: number;
      unitPriceCents: number;
    };
    if (!Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({ error: 'Item quantity must be a positive integer' });
      return;
    }
    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
      res.status(400).json({ error: 'Item unitPriceCents must be a non-negative integer' });
      return;
    }
    if (!store.getProductById(productId)) {
      res.status(404).json({ error: `Product not found: ${productId}` });
      return;
    }
    validated.push({ productId, quantity, unitPriceCents });
  }

  // Check stock availability for each item
  for (const item of validated) {
    const available = store.stockLevel(item.productId, tenantId);
    if (available < item.quantity) {
      res.status(422).json({
        error: `Insufficient stock for product ${item.productId}`,
        available,
        requested: item.quantity,
      });
      return;
    }
  }

  // Deduct stock
  for (const item of validated) {
    store.adjustStock(item.productId, tenantId, -item.quantity, `Order deduction`);
  }

  const totalCents = validated.reduce((sum, i) => sum + i.quantity * i.unitPriceCents, 0);
  const order = store.createOrder(tenantId, validated, totalCents);

  res.status(201).json(order);
});

/**
 * GET /orders
 *
 * List all orders for the authenticated tenant.
 */
router.get('/', (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 'default';
  res.json(store.listOrders(tenantId));
});

/**
 * GET /orders/:id
 *
 * Get a single order.
 */
router.get('/:id', (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 'default';
  const order = store.getOrder(String(req.params['id'] ?? ''), tenantId);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const orderPayments = store.getPaymentsForOrder(order.id, tenantId);
  res.json({ ...order, payments: orderPayments });
});

/**
 * PATCH /orders/:id/cancel
 *
 * Cancel a pending order and restore stock.
 */
router.patch('/:id/cancel', (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 'default';
  const order = store.getOrder(String(req.params['id'] ?? ''), tenantId);

  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  if (order.status !== 'pending') {
    res.status(409).json({ error: `Cannot cancel an order with status "${order.status}"` });
    return;
  }

  // Restore stock
  for (const item of order.items) {
    store.adjustStock(item.productId, tenantId, item.quantity, `Order cancellation restore`);
  }

  const updated = store.updateOrderStatus(order.id, tenantId, 'cancelled');
  res.json(updated);
});

export default router;
