import type { Request, Response, NextFunction } from 'express';
import { verifyJwt, extractBearerToken } from '../auth';
import { config } from '../config';
import type { JwtPayload } from '../auth';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * JWT authentication middleware.
 *
 * If JWT_SECRET is not configured the middleware is a no-op (same pattern as
 * apiKeyAuth) so that unauthenticated test environments continue to work.
 *
 * When enabled, the middleware reads the Authorization header
 * (`Bearer <token>`), verifies the token, and attaches the decoded payload to
 * `req.user`.  Missing or invalid tokens get a 401 response.
 */
export function jwtAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = config.jwtSecret;
  if (!secret) {
    next();
    return;
  }

  const token = extractBearerToken(req.headers['authorization']);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: missing or malformed Authorization header' });
    return;
  }

  const payload = verifyJwt(token, secret);
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
    return;
  }

  req.user = payload;
  next();
}
