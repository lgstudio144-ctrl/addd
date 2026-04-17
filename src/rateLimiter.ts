/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Tracks request counts per key (typically the client IP).  After more than
 * `maxRequests` attempts within `windowMs` milliseconds the limiter returns
 * a 429 response.
 *
 * This is intentionally lightweight — it is suitable for single-instance
 * deployments and CI test environments.  For multi-instance production
 * deployments, replace with a distributed store (e.g. Redis via `rate-limiter-flexible`).
 */
import type { Request, Response, NextFunction } from 'express';

interface Slot {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Slot>();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return req.socket.remoteAddress ?? 'unknown';
}

/**
 * Returns an Express middleware that enforces a sliding-window rate limit.
 * Default: 10 requests per 15-minute window per client IP.
 */
export function createRateLimiter(
  maxRequests = 10,
  windowMs = 15 * 60 * 1000,
): (req: Request, res: Response, next: NextFunction) => void {
  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const key = getClientIp(req);
    const now = Date.now();
    const slot = windows.get(key);

    if (!slot || now >= slot.resetAt) {
      windows.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (slot.count >= maxRequests) {
      res.status(429).json({ error: 'Too many requests — please try again later' });
      return;
    }

    slot.count += 1;
    next();
  };
}

/** Visible for testing — resets all counters. */
export function _clearRateLimiter(): void {
  windows.clear();
}
