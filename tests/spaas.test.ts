import request from 'supertest';
import { createApp } from '../src/app';
import { store } from '../src/store';
import { seedStore } from '../src/seeder';
import { spaasCatalog } from '../src/seeds/spaas';

const app = createApp();

beforeEach(() => {
  store._clear();
  // Re-seed before every test so Spaas products are always available.
  seedStore(spaasCatalog);
});

describe('Spaas catalog — seeding', () => {
  it('loads all Spaas products into the store', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(spaasCatalog.length);
  });

  it('each seeded product has the correct barcode and name', async () => {
    const res = await request(app).get('/api/v1/products');
    const barcodes: string[] = res.body.map((p: { barcode: string }) => p.barcode);
    for (const entry of spaasCatalog) {
      expect(barcodes).toContain(entry.barcode);
    }
  });

  it('is idempotent — calling seedStore twice does not duplicate products', async () => {
    seedStore(spaasCatalog); // second call
    const res = await request(app).get('/api/v1/products');
    expect(res.body).toHaveLength(spaasCatalog.length);
  });
});

describe('Spaas catalog — scanner integration', () => {
  it('resolves a Spaas tea light barcode via POST /scan (hardware scanner path)', async () => {
    const teaLight = spaasCatalog.find((e) => e.name.includes('Tea Lights White 50pc'))!;
    const res = await request(app).post('/api/v1/scan').send({ barcode: teaLight.barcode });

    expect(res.status).toBe(200);
    expect(res.body.barcode).toBe(teaLight.barcode);
    expect(res.body.product.name).toBe(teaLight.name);
    expect(res.body.product.description).toBe(teaLight.description);
  });

  it('resolves a Spaas pillar candle barcode via POST /scan', async () => {
    const pillar = spaasCatalog.find((e) => e.name.includes('Pillar Candle White 13 cm'))!;
    const res = await request(app).post('/api/v1/scan').send({ barcode: pillar.barcode });

    expect(res.status).toBe(200);
    expect(res.body.product.name).toBe(pillar.name);
  });

  it('resolves a Spaas LED tea light barcode via POST /scan', async () => {
    const led = spaasCatalog.find((e) => e.name.includes('LED Tea Lights'))!;
    const res = await request(app).post('/api/v1/scan').send({ barcode: led.barcode });

    expect(res.status).toBe(200);
    expect(res.body.product.name).toBe(led.name);
  });

  it('returns 404 for a non-Spaas barcode (scanner path)', async () => {
    const res = await request(app).post('/api/v1/scan').send({ barcode: 'UNKNOWN-BRAND-9999' });

    expect(res.status).toBe(404);
    expect(res.body.barcode).toBe('UNKNOWN-BRAND-9999');
  });
});

describe('Spaas catalog — product lookup', () => {
  it('fetches a seeded Spaas product by ID with null currentLocation', async () => {
    // Find the product id from the list endpoint
    const listRes = await request(app).get('/api/v1/products');
    const teaLight = listRes.body.find((p: { name: string }) =>
      p.name.includes('Tea Lights White 100pc'),
    );
    expect(teaLight).toBeDefined();

    const res = await request(app).get(`/api/v1/products/${teaLight.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(teaLight.id);
    expect(res.body.currentLocation).toBeNull();
  });

  it('records a placement for a Spaas product and resolves it via scan', async () => {
    // Locate the Citronella product
    const citronella = spaasCatalog.find((e) => e.name.includes('Outdoor Candle Citronella'))!;

    // Record a placement via the products endpoint
    const listRes = await request(app).get('/api/v1/products');
    const product = listRes.body.find((p: { barcode: string }) => p.barcode === citronella.barcode);

    await request(app)
      .post(`/api/v1/products/${product.id}/placement`)
      .send({ location: 'stock', note: 'Initial delivery' });

    // Scanning should now show the placement
    const scanRes = await request(app).post('/api/v1/scan').send({ barcode: citronella.barcode });

    expect(scanRes.status).toBe(200);
    expect(scanRes.body.currentLocation).toBe('stock');
  });
});
