import request from 'supertest';
import { createApp } from '../src/app';
import { store } from '../src/store';
import { seedStore } from '../src/seeder';
import { spaasCatalog } from '../src/seeds/spaas';

const app = createApp();

beforeEach(() => {
  store._clear();
  seedStore(spaasCatalog);
});

// Helper: get a known Spaas product id from the API
async function getFirstProductId(): Promise<string> {
  const res = await request(app).get('/api/v1/products');
  return (res.body as Array<{ id: string }>)[0]!.id;
}

describe('GET /api/v1/stock', () => {
  it('returns an empty array when no adjustments have been made', async () => {
    const res = await request(app).get('/api/v1/stock');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('lists products with stock after an adjustment', async () => {
    const productId = await getFirstProductId();
    await request(app)
      .post(`/api/v1/stock/${productId}/adjust`)
      .send({ delta: 50, reason: 'Initial delivery' });

    const res = await request(app).get('/api/v1/stock');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ productId, quantity: 50 });
  });
});

describe('GET /api/v1/stock/:productId', () => {
  it('returns 404 for an unknown product', async () => {
    const res = await request(app).get('/api/v1/stock/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('returns quantity 0 for a product with no adjustments', async () => {
    const productId = await getFirstProductId();
    const res = await request(app).get(`/api/v1/stock/${productId}`);
    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(0);
    expect(res.body.history).toEqual([]);
  });

  it('returns the accumulated quantity after multiple adjustments', async () => {
    const productId = await getFirstProductId();
    await request(app).post(`/api/v1/stock/${productId}/adjust`).send({ delta: 100 });
    await request(app).post(`/api/v1/stock/${productId}/adjust`).send({ delta: -30 });

    const res = await request(app).get(`/api/v1/stock/${productId}`);
    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(70);
    expect(res.body.history).toHaveLength(2);
  });
});

describe('POST /api/v1/stock/:productId/adjust', () => {
  it('returns 404 for an unknown product', async () => {
    const res = await request(app).post('/api/v1/stock/no-such-id/adjust').send({ delta: 10 });
    expect(res.status).toBe(404);
  });

  it('returns 400 when delta is missing', async () => {
    const productId = await getFirstProductId();
    const res = await request(app)
      .post(`/api/v1/stock/${productId}/adjust`)
      .send({ reason: 'no delta' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when delta is zero', async () => {
    const productId = await getFirstProductId();
    const res = await request(app).post(`/api/v1/stock/${productId}/adjust`).send({ delta: 0 });
    expect(res.status).toBe(400);
  });

  it('creates a stock-in event and returns 201 with new quantity', async () => {
    const productId = await getFirstProductId();
    const res = await request(app)
      .post(`/api/v1/stock/${productId}/adjust`)
      .send({ delta: 24, reason: 'Supplier delivery' });
    expect(res.status).toBe(201);
    expect(res.body.event).toMatchObject({ productId, delta: 24, reason: 'Supplier delivery' });
    expect(res.body.quantity).toBe(24);
  });

  it('returns 422 when adjustment would result in negative stock', async () => {
    const productId = await getFirstProductId();
    await request(app).post(`/api/v1/stock/${productId}/adjust`).send({ delta: 5 });
    const res = await request(app).post(`/api/v1/stock/${productId}/adjust`).send({ delta: -10 });
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('currentQuantity', 5);
  });
});
