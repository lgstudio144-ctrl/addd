import request from 'supertest';
import { createApp } from '../src/app';
import { store } from '../src/store';

const app = createApp();

beforeEach(() => store._clear());

describe('GET /api/v1/products', () => {
  it('returns an empty array when no products exist', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('lists registered products with their current location', async () => {
    const p = store.createProduct('BAR-001', 'Whisky');
    store.recordPlacement(p.id, 'bar');
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ barcode: 'BAR-001', currentLocation: 'bar' });
  });
});

describe('POST /api/v1/products', () => {
  it('creates a product and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .send({ barcode: 'SKU-999', name: 'Gin', description: 'London dry' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ barcode: 'SKU-999', name: 'Gin' });
    expect(res.body).toHaveProperty('id');
  });

  it('returns 400 when barcode or name is missing', async () => {
    const res = await request(app).post('/api/v1/products').send({ name: 'Gin' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when barcode is already registered', async () => {
    await request(app).post('/api/v1/products').send({ barcode: 'DUP-1', name: 'A' });
    const res = await request(app).post('/api/v1/products').send({ barcode: 'DUP-1', name: 'B' });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/v1/products/:id', () => {
  it('returns the product with current location', async () => {
    const p = store.createProduct('KIT-01', 'Oil');
    store.recordPlacement(p.id, 'kitchen');
    const res = await request(app).get(`/api/v1/products/${p.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: p.id, currentLocation: 'kitchen' });
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/v1/products/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/products/:id/placement', () => {
  it('records a placement event and returns 201', async () => {
    const p = store.createProduct('STK-01', 'Vodka');
    const res = await request(app)
      .post(`/api/v1/products/${p.id}/placement`)
      .send({ location: 'stock', note: 'Arrived from supplier' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ location: 'stock', productId: p.id });
  });

  it('returns 400 for an invalid location', async () => {
    const p = store.createProduct('INV-01', 'Rum');
    const res = await request(app)
      .post(`/api/v1/products/${p.id}/placement`)
      .send({ location: 'spaceship' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown product', async () => {
    const res = await request(app)
      .post('/api/v1/products/no-such-id/placement')
      .send({ location: 'bar' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/products/:id/trace', () => {
  it('returns full placement history for a product', async () => {
    const p = store.createProduct('TRC-01', 'Beer');
    store.recordPlacement(p.id, 'stock');
    store.recordPlacement(p.id, 'bar');
    store.recordPlacement(p.id, 'transit');
    store.recordPlacement(p.id, 'delivered');

    const res = await request(app).get(`/api/v1/products/${p.id}/trace`);
    expect(res.status).toBe(200);
    expect(res.body.currentLocation).toBe('delivered');
    expect(res.body.history).toHaveLength(4);
    expect(res.body.history[0]).toMatchObject({ location: 'stock' });
    expect(res.body.history[3]).toMatchObject({ location: 'delivered' });
  });

  it('returns 404 for unknown product', async () => {
    const res = await request(app).get('/api/v1/products/ghost/trace');
    expect(res.status).toBe(404);
  });
});
