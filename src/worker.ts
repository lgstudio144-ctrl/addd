/**
 * Cloudflare Workers entry point.
 *
 * `wrangler dev`  — local Workers sandbox (uses Miniflare)
 * `wrangler deploy` — deploys to your Cloudflare account
 *
 * Environment variables are set in wrangler.toml (vars / secrets):
 *   API_KEY  — optional; if set, every request must include X-Api-Key header
 */
import { Hono } from 'hono';
import { createHonoApp } from './hono-app';
import type { Bindings } from './hono-app';
import { seedStore } from './seeder';
import { spaasCatalog } from './seeds/spaas';

// Pre-load the Spaas product catalog at module-initialisation time so every
// known Spaas barcode resolves immediately on the first request the Worker
// receives (module state persists across requests within a Worker instance).
seedStore(spaasCatalog);

const apiPrefix =
  (typeof process !== 'undefined' ? process.env['API_PREFIX'] : undefined) ?? '/api/v1';

// Mount the Hono app under the API prefix so the Worker URL structure matches
// the Express server (e.g. /api/v1/products, /api/v1/scan, /api/v1/health).
const worker = new Hono<{ Bindings: Bindings }>();
worker.route(apiPrefix, createHonoApp());

export default worker;
