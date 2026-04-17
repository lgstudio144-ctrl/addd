# addd

A Node.js + TypeScript REST API for barcode/QR-based product tracking — with built-in Spaas product catalog and Cloudflare Workers deployment support.

[![CI](https://github.com/lgstudio144-ctrl/addd/actions/workflows/ci.yml/badge.svg)](https://github.com/lgstudio144-ctrl/addd/actions/workflows/ci.yml)

---

## Architecture

```
src/
  config.ts          – Environment/config loading (dotenv)
  app.ts             – Express application factory
  server.ts          – Entry point; seeds Spaas catalog then starts HTTP listener
  hono-app.ts        – Hono app (Cloudflare Workers + Node.js compatible)
  worker.ts          – Cloudflare Workers entry point
  seeder.ts          – Idempotent catalog seeder
  store.ts           – In-memory product & placement store
  seeds/
    spaas.ts         – Spaas product catalog (25 products, EAN-13 barcodes)
  routes/
    index.ts         – Mounts all route groups
    health.ts        – GET  /api/v1/health
    products.ts      – GET/POST /api/v1/products, placement, trace
    scan.ts          – POST /api/v1/scan (barcode string or QR image)
  middleware/
    apiKeyAuth.ts    – Optional API-key guard (X-Api-Key header)
    errorHandler.ts  – Centralised error-handling middleware
tests/
  health.test.ts
  products.test.ts
  scan.test.ts
  apiKeyAuth.test.ts
  spaas.test.ts      – Spaas catalog + scanner/camera integration tests
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

### `GET /health`

Returns server liveness.

```json
{ "status": "ok", "timestamp": "2026-04-17T00:00:00.000Z" }
```

### `POST /scan`

Resolves a barcode to a registered product. Accepts either:

- **JSON body** `{ "barcode": "8719817000014" }` — raw string from a hardware scanner
- **`multipart/form-data`** with field `image` — JPEG/PNG containing a QR code (camera path)

Returns the matched product and its current location, or `404` with the decoded barcode if unregistered.

### `GET /products`

Lists all registered products with their current location.

### `POST /products`

Registers a new product. Body: `{ barcode, name, description? }`.

### `GET /products/:id`

Returns a single product with current location.

### `POST /products/:id/placement`

Records a placement event. Body: `{ location, note? }`.  
Valid locations: `stock`, `bar`, `kitchen`, `transit`, `delivered`.

### `GET /products/:id/trace`

Returns the full chronological placement history for a product.

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

# 3. Deploy
npm run deploy:staging
```

Environment variables (`API_PREFIX`, etc.) live in `wrangler.toml`; secrets go via `wrangler secret put`.

---

## Contributing

1. Fork → feature branch → PR against `main`
2. All CI checks (lint, format, test, build) must pass
3. Follow the existing code style (ESLint + Prettier enforce it)
