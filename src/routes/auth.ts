import { Router } from 'express';
import type { Request, Response } from 'express';
import { store } from '../store';
import { hashPassword, verifyPassword, signJwt } from '../auth';
import { config } from '../config';
import { createRateLimiter } from '../rateLimiter';
import type { UserRole } from '../store';

const router = Router();

const VALID_ROLES: UserRole[] = ['admin', 'staff'];

// 10 register/login attempts per 15 minutes per IP
const authRateLimit = createRateLimiter(10, 15 * 60 * 1000);

/**
 * POST /auth/register
 *
 * Register a new user for a tenant.
 * Body: { tenantId, email, password, role? }
 * Returns: { token, user: { id, tenantId, email, role, createdAt } }
 */
router.post('/register', authRateLimit, async (req: Request, res: Response): Promise<void> => {
  const { tenantId, email, password, role } = req.body as {
    tenantId?: string;
    email?: string;
    password?: string;
    role?: string;
  };

  if (!tenantId || !email || !password) {
    res.status(400).json({ error: 'tenantId, email, and password are required' });
    return;
  }

  if (!email.includes('@')) {
    res.status(400).json({ error: 'email must be a valid email address' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'password must be at least 8 characters' });
    return;
  }

  const resolvedRole: UserRole =
    role && VALID_ROLES.includes(role as UserRole) ? (role as UserRole) : 'staff';

  if (store.getUserByEmail(email)) {
    res.status(409).json({ error: 'A user with this email already exists' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = store.createUser(tenantId, email, passwordHash, resolvedRole);

  const safeUser = {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };

  if (!config.jwtSecret) {
    // No JWT secret configured — return user without token
    res.status(201).json({ user: safeUser });
    return;
  }

  const token = signJwt(
    { sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role },
    config.jwtSecret,
  );

  res.status(201).json({ token, user: safeUser });
});

/**
 * POST /auth/login
 *
 * Authenticate an existing user.
 * Body: { email, password }
 * Returns: { token, user: { id, tenantId, email, role, createdAt } }
 */
router.post('/login', authRateLimit, async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const user = store.getUserByEmail(email);
  if (!user) {
    // Avoid user-enumeration timing attack by still checking password
    await hashPassword(password);
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const safeUser = {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };

  if (!config.jwtSecret) {
    res.json({ user: safeUser });
    return;
  }

  const token = signJwt(
    { sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role },
    config.jwtSecret,
  );

  res.json({ token, user: safeUser });
});

export default router;
