# addd

A Node.js + TypeScript REST API for barcode/QR-based product tracking — with built-in Spaas product catalog, multi-tenant login, stock management, orders, and payment recording. Deployable to Cloudflare Workers.

[![CI](https://github.com/lgstudio144-ctrl/addd/actions/workflows/ci.yml/badge.svg)](https://github.com/lgstudio144-ctrl/addd/actions/workflows/ci.yml)

---

## Architecture

```
src/
  config.ts          – Environment/config loading (dotenv)
  auth.ts            – HS256 JWT sign/verify + scrypt password hashing (Node built-ins)
  app.ts             – Express application factory
  server.ts          – Entry point; seeds Spaas catalog then starts HTTP listener
  hono-app.ts        – Hono app (Cloudflare Workers + Node.js compatible)
  worker.ts          – Cloudflare Workers entry point
  seeder.ts          – Idempotent catalog seeder
  store.ts           – In-memory store: products, placements, users, stock, orders, payments
  seeds/
    spaas.ts         – Spaas product catalog (25 products, EAN-13 barcodes)
  routes/
    index.ts         – Mounts all route groups
    health.ts        – GET  /api/v1/health  (public)
    auth.ts          – POST /api/v1/auth/register, /auth/login  (public)
    products.ts      – GET/POST /api/v1/products, placement, trace  (protected)
    scan.ts          – POST /api/v1/scan (barcode string or QR image)  (protected)
    stock.ts         – GET/POST /api/v1/stock  (protected)
    orders.ts        – GET/POST /api/v1/orders, cancel  (protected)
    payments.ts      – POST /api/v1/orders/:id/pay  (protected)
  middleware/
    apiKeyAuth.ts    – Optional service-level API-key guard (X-Api-Key header)
    jwtAuth.ts       – JWT user-session guard (Bearer token)
    errorHandler.ts  – Centralised error-handling middleware
tests/
  health.test.ts
  products.test.ts
  scan.test.ts
  apiKeyAuth.test.ts
  spaas.test.ts      – Spaas catalog + scanner/camera integration tests
  auth.test.ts       – Register & login flows
  stock.test.ts      – Stock adjustment & levels
  orders.test.ts     – Order lifecycle + payment recording
```

## Prerequisites

- Node.js ≥ 20
- npm ≥ 10

## Setup

```bash
git clone https://github.com/lgstudio144-ctrl/addd.git
cd addd
npm install
cp .env.example .env   # edit as needed
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot-reload (port 3000) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled server |
| `npm run dev:worker` | Local Cloudflare Workers sandbox (port 8787) |
| `npm run build:worker` | Compile worker → `dist-worker/` |
| `npm run deploy:staging` | Deploy to `addd-staging` Cloudflare Worker |
| `npm run deploy:production` | Deploy to `addd-production` Cloudflare Worker |
| `npm test` | Run Jest tests |
| `npm run test:coverage` | Tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix ESLint issues |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |

## API

All endpoints are prefixed with `/api/v1` (configurable via `API_PREFIX`).

### Authentication

Protected routes require a `Bearer` token in the `Authorization` header (when `JWT_SECRET` is configured). Obtain a token via `POST /auth/login`.

### `GET /health` *(public)*

Returns server liveness.

```json
{ "status": "ok", "timestamp": "2026-04-17T00:00:00.000Z" }
```

### `POST /auth/register` *(public)*

Register a new user for a tenant.

```json
{ "tenantId": "acme", "email": "alice@acme.com", "password": "supersecret", "role": "admin" }
```

Returns `{ token, user }`. `role` is optional — defaults to `staff`.

### `POST /auth/login` *(public)*

Authenticate and obtain a JWT.

```json
{ "email": "alice@acme.com", "password": "supersecret" }
```

Returns `{ token, user }`.

### `POST /scan` *(protected)*

Resolves a barcode to a registered product. Accepts either:

- **JSON body** `{ "barcode": "8719817000014" }` — raw string from a hardware scanner
- **`multipart/form-data`** with field `image` — JPEG/PNG containing a QR code (camera path)

Returns the matched product and its current location, or `404` with the decoded barcode if unregistered.

### `GET /products` *(protected)*

Lists all registered products with their current location.

### `POST /products` *(protected)*

Registers a new product. Body: `{ barcode, name, description? }`.

### `GET /products/:id` *(protected)*

Returns a single product with current location.

### `POST /products/:id/placement` *(protected)*

Records a placement event. Body: `{ location, note? }`.  
Valid locations: `stock`, `bar`, `kitchen`, `transit`, `delivered`.

### `GET /products/:id/trace` *(protected)*

Returns the full chronological placement history for a product.

### `GET /stock` *(protected)*

Returns current stock levels for all products within the authenticated tenant.

### `GET /stock/:productId` *(protected)*

Returns stock quantity + adjustment history for a single product.

### `POST /stock/:productId/adjust` *(protected)*

Record a stock adjustment. Body: `{ delta: number, reason?: string }`.  
Positive `delta` = stock received; negative = stock consumed. Returns new quantity.

### `POST /orders` *(protected)*

Create an order; stock is automatically deducted.  
Body: `{ items: [{ productId, quantity, unitPriceCents }] }`

### `GET /orders` *(protected)*

List all orders for the authenticated tenant.

### `GET /orders/:id` *(protected)*

Get a single order including all associated payments.

### `PATCH /orders/:id/cancel` *(protected)*

Cancel a pending order; stock is restored.

### `POST /orders/:id/pay` *(protected)*

Record a payment against an order.  
Body: `{ method: "card" | "cash" | "bank_transfer", reference?: string }`  
Marks the order as `paid`.

### `GET /orders/:id/payments` *(protected)*

List all payments recorded for an order.

---

## Spaas Product Catalog

On startup the server automatically seeds the in-memory store with **25 Spaas candle products** (tea lights, pillar candles, scented candles, dinner candles, outdoor/citronella, floating, glass, and LED lines). Their EAN-13 barcodes are pre-registered so any Spaas scan resolves immediately without a prior `POST /products` call.

Example — scan a Spaas Tea Lights 50pc barcode:

```bash
curl -X POST http://localhost:3000/api/v1/scan \
  -H 'Content-Type: application/json' \
  -d '{"barcode":"8719817000014"}'
```

```json
{
  "barcode": "8719817000014",
  "product": {
    "id": "...",
    "barcode": "8719817000014",
    "name": "Spaas Tea Lights White 50pc",
    "description": "Unscented white tea lights, 4-hour burn time, pack of 50.",
    "createdAt": "2026-04-17T00:00:00.000Z"
  },
  "currentLocation": null
}
```

---

## Cloudflare Workers deployment

```bash
# 1. Authenticate
npx wrangler login

# 2. Set secrets (never committed)
npx wrangler secret put API_KEY --env staging
npx wrangler secret put JWT_SECRET --env staging

# 3. Deploy
npm run deploy:staging
```

Environment variables (`API_PREFIX`, etc.) live in `wrangler.toml`; secrets go via `wrangler secret put`.

---

## Contributing

1. Fork → feature branch → PR against `main`
2. All CI checks (lint, format, test, build) must pass
3. Follow the existing code style (ESLint + Prettier enforce it)
