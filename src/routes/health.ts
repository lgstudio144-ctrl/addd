import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

/**
 * GET /health
 * Returns a basic liveness check response.
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
