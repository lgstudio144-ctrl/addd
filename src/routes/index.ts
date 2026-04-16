import { Router } from 'express';
import healthRouter from './health';
import productsRouter from './products';
import scanRouter from './scan';

const router = Router();

router.use('/health', healthRouter);
router.use('/products', productsRouter);
router.use('/scan', scanRouter);

export default router;
