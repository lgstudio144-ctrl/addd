/**
 * Hono application — runs identically on Cloudflare Workers and Node.js.
 *
 * All routes mirror the Express app so the behaviour is consistent across
 * both runtimes.  Key differences from the Express version:
 *
 *  • Image uploads are parsed with the Web Platform FormData API instead of
 *    multer (which relies on Node.js streams unavailable in CF Workers).
 *  • Environment variables are taken from Hono's `c.env` bindings in Workers
 *    and from `process.env` on Node.js.
 */
import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { Jimp } from 'jimp';
import jsQR from 'jsqr';
import { store } from './store';
import type { Location, OrderItem, PaymentMethod, UserRole, OrderStatus } from './store';
import { hashPassword, verifyPassword, signJwt, verifyJwt, extractBearerToken } from './auth';
import type { JwtPayload } from './auth';

export type Bindings = {
  API_KEY?: string;
  API_PREFIX?: string;
  JWT_SECRET?: string;
};

type Variables = {
  jwtPayload: JwtPayload;
};

const VALID_LOCATIONS: Location[] = ['stock', 'bar', 'kitchen', 'transit', 'delivered'];
const VALID_PAYMENT_METHODS: PaymentMethod[] = ['card', 'cash', 'bank_transfer'];
const VALID_ROLES: UserRole[] = ['admin', 'staff'];

// ── QR decoder (shared) ──────────────────────────────────────────────────────

async function decodeQRFromBuffer(buffer: Buffer): Promise<string | null> {
  const image = await Jimp.read(buffer);
  const { data, width, height } = image.bitmap;
  const result = jsQR(new Uint8ClampedArray(data.buffer), width, height);
  return result ? result.data : null;
}

// ── Env helper ───────────────────────────────────────────────────────────────

function getEnv(key: string, envBindings?: Bindings): string | undefined {
  return (
    (envBindings as Record<string, string | undefined> | undefined)?.[key] ??
    (typeof process !== 'undefined' ? process.env[key] : undefined)
  );
}

// ── App factory ──────────────────────────────────────────────────────────────

export function createHonoApp(): Hono<{ Bindings: Bindings; Variables: Variables }> {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  // ── API-key guard ──────────────────────────────────────────────────────────

  app.use('*', async (c, next) => {
    const apiKey = getEnv('API_KEY', c.env);

    if (!apiKey) {
      await next();
      return;
    }

    const provided = c.req.header('x-api-key');
    if (!provided || provided !== apiKey) {
      return c.json({ error: 'Unauthorized: invalid or missing API key' }, 401);
    }

    await next();
  });

  // ── JWT guard (applied to protected routes below) ─────────────────────────

  const jwtGuard: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (
    c,
    next,
  ) => {
    const secret = getEnv('JWT_SECRET', c.env);
    if (!secret) {
      await next();
      return;
    }

    const token = extractBearerToken(c.req.header('authorization'));
    if (!token) {
      return c.json({ error: 'Unauthorized: missing or malformed Authorization header' }, 401);
    }

    const payload = verifyJwt(token, secret);
    if (!payload) {
      return c.json({ error: 'Unauthorized: invalid or expired token' }, 401);
    }

    c.set('jwtPayload', payload);
    await next();
  };

  // ── Health ─────────────────────────────────────────────────────────────────

  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // ── Auth ───────────────────────────────────────────────────────────────────

  /** POST /auth/register */
  app.post('/auth/register', async (c) => {
    const body = await c.req.json<{
      tenantId?: string;
      email?: string;
      password?: string;
      role?: string;
    }>();
    const { tenantId, email, password, role } = body;

    if (!tenantId || !email || !password) {
      return c.json({ error: 'tenantId, email, and password are required' }, 400);
    }
    if (!email.includes('@')) {
      return c.json({ error: 'email must be a valid email address' }, 400);
    }
    if (password.length < 8) {
      return c.json({ error: 'password must be at least 8 characters' }, 400);
    }

    const resolvedRole: UserRole =
      role && VALID_ROLES.includes(role as UserRole) ? (role as UserRole) : 'staff';

    if (store.getUserByEmail(email)) {
      return c.json({ error: 'A user with this email already exists' }, 409);
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

    const secret = getEnv('JWT_SECRET', c.env);
    if (!secret) return c.json({ user: safeUser }, 201);

    const token = signJwt(
      { sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role },
      secret,
    );
    return c.json({ token, user: safeUser }, 201);
  });

  /** POST /auth/login */
  app.post('/auth/login', async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'email and password are required' }, 400);
    }

    const user = store.getUserByEmail(email);
    if (!user) {
      await hashPassword(password); // constant-time guard
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return c.json({ error: 'Invalid email or password' }, 401);

    const safeUser = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
    const secret = getEnv('JWT_SECRET', c.env);
    if (!secret) return c.json({ user: safeUser });

    const token = signJwt(
      { sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role },
      secret,
    );
    return c.json({ token, user: safeUser });
  });

  // ── Products ───────────────────────────────────────────────────────────────

  /** GET /products — list all products with current location */
  app.get('/products', jwtGuard, (c) => {
    const products = store.listProducts().map((p) => ({
      ...p,
      currentLocation: store.currentLocation(p.id),
    }));
    return c.json(products);
  });

  /** POST /products — register a product */
  app.post('/products', jwtGuard, async (c) => {
    const body = await c.req.json<{ barcode?: string; name?: string; description?: string }>();
    const { barcode, name, description } = body;

    if (!barcode || !name) {
      return c.json({ error: 'barcode and name are required' }, 400);
    }

    if (store.getProductByBarcode(barcode)) {
      return c.json({ error: 'A product with this barcode already exists' }, 409);
    }

    const product = store.createProduct(barcode, name, description);
    return c.json(product, 201);
  });

  /** GET /products/:id */
  app.get('/products/:id', jwtGuard, (c) => {
    const product = store.getProductById(c.req.param('id'));
    if (!product) return c.json({ error: 'Product not found' }, 404);
    return c.json({ ...product, currentLocation: store.currentLocation(product.id) });
  });

  /** POST /products/:id/placement */
  app.post('/products/:id/placement', jwtGuard, async (c) => {
    const product = store.getProductById(c.req.param('id'));
    if (!product) return c.json({ error: 'Product not found' }, 404);

    const body = await c.req.json<{ location?: string; note?: string }>();
    const { location, note } = body;

    if (!location || !VALID_LOCATIONS.includes(location as Location)) {
      return c.json({ error: `location must be one of: ${VALID_LOCATIONS.join(', ')}` }, 400);
    }

    const event = store.recordPlacement(product.id, location as Location, note);
    return c.json(event, 201);
  });

  /** GET /products/:id/trace */
  app.get('/products/:id/trace', jwtGuard, (c) => {
    const product = store.getProductById(c.req.param('id'));
    if (!product) return c.json({ error: 'Product not found' }, 404);
    return c.json({
      product,
      currentLocation: store.currentLocation(product.id),
      history: store.getTrace(product.id),
    });
  });

  // ── Scan ───────────────────────────────────────────────────────────────────

  /**
   * POST /scan
   *
   * Accepts either:
   *  • JSON body  { barcode: string }  — raw string from a hardware scanner
   *  • multipart/form-data with field "image" (JPEG/PNG with a QR code)
   */
  app.post('/scan', jwtGuard, async (c) => {
    let barcode: string | null = null;

    const contentType = c.req.header('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const file = formData.get('image');

      if (!file || !(file instanceof File)) {
        return c.json({ error: 'No "image" file found in form data' }, 400);
      }

      const arrayBuffer = await file.arrayBuffer();
      const decoded = await decodeQRFromBuffer(Buffer.from(arrayBuffer));

      if (!decoded) {
        return c.json({ error: 'No QR code detected in the uploaded image' }, 422);
      }

      barcode = decoded;
    } else {
      const body = await c.req.json<{ barcode?: unknown }>();
      if (typeof body.barcode === 'string') {
        barcode = body.barcode.trim();
      }
    }

    if (!barcode) {
      return c.json(
        { error: 'Provide a "barcode" string in the body or an "image" file upload' },
        400,
      );
    }

    const product = store.getProductByBarcode(barcode);
    if (!product) {
      return c.json(
        {
          barcode,
          error: 'No product registered for this barcode — register it first via POST /products',
        },
        404,
      );
    }

    return c.json({ barcode, product, currentLocation: store.currentLocation(product.id) });
  });

  // ── Stock ──────────────────────────────────────────────────────────────────

  /** GET /stock — all stock levels for the tenant */
  app.get('/stock', jwtGuard, (c) => {
    const tenantId = c.get('jwtPayload')?.tenantId ?? 'default';
    const levels = store.stockLevels(tenantId).map((l) => ({
      ...l,
      product: store.getProductById(l.productId),
    }));
    return c.json(levels);
  });

  /** GET /stock/:productId */
  app.get('/stock/:productId', jwtGuard, (c) => {
    const tenantId = c.get('jwtPayload')?.tenantId ?? 'default';
    const productId = c.req.param('productId');
    const product = store.getProductById(productId);
    if (!product) return c.json({ error: 'Product not found' }, 404);
    return c.json({
      product,
      quantity: store.stockLevel(productId, tenantId),
      history: store.stockHistory(productId, tenantId),
    });
  });

  /** POST /stock/:productId/adjust */
  app.post('/stock/:productId/adjust', jwtGuard, async (c) => {
    const tenantId = c.get('jwtPayload')?.tenantId ?? 'default';
    const productId = c.req.param('productId');
    const product = store.getProductById(productId);
    if (!product) return c.json({ error: 'Product not found' }, 404);

    const body = await c.req.json<{ delta?: unknown; reason?: string }>();
    const { delta, reason } = body;

    if (typeof delta !== 'number' || !Number.isFinite(delta) || delta === 0) {
      return c.json({ error: '"delta" must be a non-zero finite number' }, 400);
    }

    const newLevel = store.stockLevel(productId, tenantId) + delta;
    if (newLevel < 0) {
      return c.json(
        {
          error: 'Adjustment would result in negative stock',
          currentQuantity: store.stockLevel(productId, tenantId),
        },
        422,
      );
    }

    const event = store.adjustStock(productId, tenantId, delta, reason ?? '');
    return c.json({ event, quantity: store.stockLevel(productId, tenantId) }, 201);
  });

  // ── Orders ─────────────────────────────────────────────────────────────────

  /** POST /orders */
  app.post('/orders', jwtGuard, async (c) => {
    const tenantId = c.get('jwtPayload')?.tenantId ?? 'default';
    const body = await c.req.json<{ items?: unknown }>();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ error: '"items" must be a non-empty array' }, 400);
    }

    const validated: OrderItem[] = [];
    for (const item of items) {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof (item as Record<string, unknown>)['productId'] !== 'string' ||
        typeof (item as Record<string, unknown>)['quantity'] !== 'number' ||
        typeof (item as Record<string, unknown>)['unitPriceCents'] !== 'number'
      ) {
        return c.json(
          {
            error:
              'Each item must have productId (string), quantity (number), unitPriceCents (number)',
          },
          400,
        );
      }
      const { productId, quantity, unitPriceCents } = item as {
        productId: string;
        quantity: number;
        unitPriceCents: number;
      };
      if (!Number.isInteger(quantity) || quantity < 1) {
        return c.json({ error: 'Item quantity must be a positive integer' }, 400);
      }
      if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
        return c.json({ error: 'Item unitPriceCents must be a non-negative integer' }, 400);
      }
      if (!store.getProductById(productId)) {
        return c.json({ error: `Product not found: ${productId}` }, 404);
      }
      validated.push({ productId, quantity, unitPriceCents });
    }

    for (const item of validated) {
      const available = store.stockLevel(item.productId, tenantId);
      if (available < item.quantity) {
        return c.json(
          {
            error: `Insufficient stock for product ${item.productId}`,
            available,
            requested: item.quantity,
          },
          422,
        );
      }
    }

    for (const item of validated) {
      store.adjustStock(item.productId, tenantId, -item.quantity, 'Order deduction');
    }

    const totalCents = validated.reduce((sum, i) => sum + i.quantity * i.unitPriceCents, 0);
    return c.json(store.createOrder(tenantId, validated, totalCents), 201);
  });

  /** GET /orders */
  app.get('/orders', jwtGuard, (c) => {
    const tenantId = c.get('jwtPayload')?.tenantId ?? 'default';
    return c.json(store.listOrders(tenantId));
  });

  /** GET /orders/:id */
  app.get('/orders/:id', jwtGuard, (c) => {
    const tenantId = c.get('jwtPayload')?.tenantId ?? 'default';
    const order = store.getOrder(c.req.param('id'), tenantId);
    if (!order) return c.json({ error: 'Order not found' }, 404);
    return c.json({ ...order, payments: store.getPaymentsForOrder(order.id, tenantId) });
  });

  /** PATCH /orders/:id/cancel */
  app.patch('/orders/:id/cancel', jwtGuard, (c) => {
    const tenantId = c.get('jwtPayload')?.tenantId ?? 'default';
    const order = store.getOrder(c.req.param('id'), tenantId);
    if (!order) return c.json({ error: 'Order not found' }, 404);
    if (order.status !== 'pending') {
      return c.json({ error: `Cannot cancel an order with status "${order.status}"` }, 409);
    }
    for (const item of order.items) {
      store.adjustStock(item.productId, tenantId, item.quantity, 'Order cancellation restore');
    }
    return c.json(store.updateOrderStatus(order.id, tenantId, 'cancelled' as OrderStatus));
  });

  // ── Payments ───────────────────────────────────────────────────────────────

  /** POST /orders/:id/pay */
  app.post('/orders/:id/pay', jwtGuard, async (c) => {
    const tenantId = c.get('jwtPayload')?.tenantId ?? 'default';
    const order = store.getOrder(c.req.param('id'), tenantId);
    if (!order) return c.json({ error: 'Order not found' }, 404);
    if (order.status !== 'pending') {
      return c.json({ error: `Cannot pay an order with status "${order.status}"` }, 409);
    }

    const body = await c.req.json<{ method?: string; reference?: string }>();
    const { method, reference } = body;

    if (!method || !VALID_PAYMENT_METHODS.includes(method as PaymentMethod)) {
      return c.json({ error: `method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}` }, 400);
    }

    const payment = store.recordPayment(
      order.id,
      tenantId,
      order.totalCents,
      method as PaymentMethod,
      reference ?? '',
    );
    store.updateOrderStatus(order.id, tenantId, 'paid' as OrderStatus);
    return c.json({ payment, order: store.getOrder(order.id, tenantId) }, 201);
  });

  /** GET /orders/:id/payments */
  app.get('/orders/:id/payments', jwtGuard, (c) => {
    const tenantId = c.get('jwtPayload')?.tenantId ?? 'default';
    const order = store.getOrder(c.req.param('id'), tenantId);
    if (!order) return c.json({ error: 'Order not found' }, 404);
    return c.json(store.getPaymentsForOrder(order.id, tenantId));
  });

  return app;
}
