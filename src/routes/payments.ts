import { Router } from 'express';
import type { Request, Response } from 'express';
import { store } from '../store';
import type { PaymentMethod } from '../store';

const router = Router({ mergeParams: true });

const VALID_METHODS: PaymentMethod[] = ['card', 'cash', 'bank_transfer'];

/**
 * POST /orders/:id/pay
 *
 * Record a payment against an order.
 * Body: { method: 'card'|'cash'|'bank_transfer', reference?: string }
 *
 * The full order total is charged; partial payments are not supported.
 * The order status is updated to "paid".
 */
router.post('/', (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 'default';
  const orderId = String(req.params['id'] ?? '');

  const order = store.getOrder(orderId, tenantId);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  if (order.status !== 'pending') {
    res.status(409).json({ error: `Cannot pay an order with status "${order.status}"` });
    return;
  }

  const { method, reference } = req.body as { method?: string; reference?: string };

  if (!method || !VALID_METHODS.includes(method as PaymentMethod)) {
    res.status(400).json({ error: `method must be one of: ${VALID_METHODS.join(', ')}` });
    return;
  }

  const payment = store.recordPayment(
    orderId,
    tenantId,
    order.totalCents,
    method as PaymentMethod,
    reference ?? '',
  );

  store.updateOrderStatus(orderId, tenantId, 'paid');

  res.status(201).json({ payment, order: store.getOrder(orderId, tenantId) });
});

/**
 * GET /orders/:id/payments
 *
 * List all payments recorded against an order.
 */
router.get('/', (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 'default';
  const orderId = String(req.params['id'] ?? '');

  const order = store.getOrder(orderId, tenantId);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  res.json(store.getPaymentsForOrder(orderId, tenantId));
});

export default router;
