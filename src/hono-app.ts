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
import { Jimp } from 'jimp';
import jsQR from 'jsqr';
import { store } from './store';
import type { Location } from './store';

export type Bindings = {
  API_KEY?: string;
  API_PREFIX?: string;
};

const VALID_LOCATIONS: Location[] = ['stock', 'bar', 'kitchen', 'transit', 'delivered'];

// ── QR decoder (shared) ──────────────────────────────────────────────────────

async function decodeQRFromBuffer(buffer: Buffer): Promise<string | null> {
  const image = await Jimp.read(buffer);
  const { data, width, height } = image.bitmap;
  const result = jsQR(new Uint8ClampedArray(data.buffer), width, height);
  return result ? result.data : null;
}

// ── App factory ──────────────────────────────────────────────────────────────

export function createHonoApp(): Hono<{ Bindings: Bindings }> {
  const app = new Hono<{ Bindings: Bindings }>();

  // ── API-key guard ──────────────────────────────────────────────────────────

  app.use('*', async (c, next) => {
    // Bindings (Workers) take priority; fall back to process.env on Node.js.
    const apiKey =
      c.env?.API_KEY ?? (typeof process !== 'undefined' ? process.env['API_KEY'] : undefined);

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

  // ── Health ─────────────────────────────────────────────────────────────────

  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // ── Products ───────────────────────────────────────────────────────────────

  /** GET /products — list all products with current location */
  app.get('/products', (c) => {
    const products = store.listProducts().map((p) => ({
      ...p,
      currentLocation: store.currentLocation(p.id),
    }));
    return c.json(products);
  });

  /** POST /products — register a product */
  app.post('/products', async (c) => {
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
  app.get('/products/:id', (c) => {
    const product = store.getProductById(c.req.param('id'));
    if (!product) return c.json({ error: 'Product not found' }, 404);
    return c.json({ ...product, currentLocation: store.currentLocation(product.id) });
  });

  /** POST /products/:id/placement */
  app.post('/products/:id/placement', async (c) => {
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
  app.get('/products/:id/trace', (c) => {
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
  app.post('/scan', async (c) => {
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

  return app;
}
