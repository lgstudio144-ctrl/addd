import { Router } from 'express';
import healthRouter from './health';
import productsRouter from './products';
import scanRouter from './scan';
import authRouter from './auth';
import stockRouter from './stock';
import ordersRouter from './orders';
import paymentsRouter from './payments';

const router = Router();

// ── Public routes ─────────────────────────────────────────────────────────────
router.use('/health', healthRouter);
router.use('/auth', authRouter);

// ── Protected routes (jwtAuth applied at app level) ───────────────────────────
router.use('/products', productsRouter);
router.use('/scan', scanRouter);
router.use('/stock', stockRouter);
router.use('/orders', ordersRouter);
// Payments are nested under orders: /orders/:id/pay and /orders/:id/payments
router.use('/orders/:id/pay', paymentsRouter);
router.use('/orders/:id/payments', paymentsRouter);

export default router;
