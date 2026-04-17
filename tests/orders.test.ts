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

// Helper: get a known Spaas product id
async function getFirstProductId(): Promise<string> {
  const res = await request(app).get('/api/v1/products');
  return (res.body as Array<{ id: string }>)[0]!.id;
}

// Helper: stock up a product and return its id
async function stockProduct(productId: string, qty: number): Promise<void> {
  await request(app).post(`/api/v1/stock/${productId}/adjust`).send({ delta: qty });
}

describe('POST /api/v1/orders', () => {
  it('returns 400 when items is missing', async () => {
    const res = await request(app).post('/api/v1/orders').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when items is empty', async () => {
    const res = await request(app).post('/api/v1/orders').send({ items: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when an item is malformed', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ quantity: 1, unitPriceCents: 100 }] }); // missing productId
    expect(res.status).toBe(400);
  });

  it('returns 404 when a product does not exist', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ productId: 'ghost', quantity: 1, unitPriceCents: 100 }] });
    expect(res.status).toBe(404);
  });

  it('returns 422 when stock is insufficient', async () => {
    const productId = await getFirstProductId();
    await stockProduct(productId, 2);

    const res = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ productId, quantity: 10, unitPriceCents: 500 }] });
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('available', 2);
  });

  it('creates an order and deducts stock — returns 201', async () => {
    const productId = await getFirstProductId();
    await stockProduct(productId, 50);

    const res = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ productId, quantity: 5, unitPriceCents: 1099 }] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'pending', totalCents: 5 * 1099 });
    expect(res.body.items).toHaveLength(1);

    // Stock should be reduced
    const stockRes = await request(app).get(`/api/v1/stock/${productId}`);
    expect(stockRes.body.quantity).toBe(45);
  });
});

describe('GET /api/v1/orders', () => {
  it('returns an empty array when no orders exist', async () => {
    const res = await request(app).get('/api/v1/orders');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('lists orders after creation', async () => {
    const productId = await getFirstProductId();
    await stockProduct(productId, 20);
    await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ productId, quantity: 1, unitPriceCents: 299 }] });

    const res = await request(app).get('/api/v1/orders');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('GET /api/v1/orders/:id', () => {
  it('returns 404 for unknown order', async () => {
    const res = await request(app).get('/api/v1/orders/ghost');
    expect(res.status).toBe(404);
  });

  it('returns the order with payments array', async () => {
    const productId = await getFirstProductId();
    await stockProduct(productId, 20);
    const createRes = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ productId, quantity: 1, unitPriceCents: 499 }] });
    const orderId: string = (createRes.body as { id: string }).id;

    const res = await request(app).get(`/api/v1/orders/${orderId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(orderId);
    expect(res.body.payments).toEqual([]);
  });
});

describe('PATCH /api/v1/orders/:id/cancel', () => {
  it('returns 404 for unknown order', async () => {
    const res = await request(app).patch('/api/v1/orders/ghost/cancel');
    expect(res.status).toBe(404);
  });

  it('cancels a pending order and restores stock', async () => {
    const productId = await getFirstProductId();
    await stockProduct(productId, 10);

    const createRes = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ productId, quantity: 3, unitPriceCents: 200 }] });
    const orderId: string = (createRes.body as { id: string }).id;

    // Stock should be 7 after order
    let stockRes = await request(app).get(`/api/v1/stock/${productId}`);
    expect(stockRes.body.quantity).toBe(7);

    const cancelRes = await request(app).patch(`/api/v1/orders/${orderId}/cancel`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('cancelled');

    // Stock should be restored to 10
    stockRes = await request(app).get(`/api/v1/stock/${productId}`);
    expect(stockRes.body.quantity).toBe(10);
  });

  it('returns 409 when trying to cancel a non-pending order', async () => {
    const productId = await getFirstProductId();
    await stockProduct(productId, 10);

    const createRes = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ productId, quantity: 1, unitPriceCents: 100 }] });
    const orderId: string = (createRes.body as { id: string }).id;

    // Pay the order first
    await request(app).post(`/api/v1/orders/${orderId}/pay`).send({ method: 'cash' });

    const res = await request(app).patch(`/api/v1/orders/${orderId}/cancel`);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/orders/:id/pay', () => {
  it('returns 404 for unknown order', async () => {
    const res = await request(app).post('/api/v1/orders/ghost/pay').send({ method: 'card' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid payment method', async () => {
    const productId = await getFirstProductId();
    await stockProduct(productId, 10);
    const createRes = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ productId, quantity: 1, unitPriceCents: 100 }] });
    const orderId: string = (createRes.body as { id: string }).id;

    const res = await request(app)
      .post(`/api/v1/orders/${orderId}/pay`)
      .send({ method: 'bitcoin' });
    expect(res.status).toBe(400);
  });

  it('records a card payment and marks order as paid', async () => {
    const productId = await getFirstProductId();
    await stockProduct(productId, 10);

    const createRes = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ productId, quantity: 2, unitPriceCents: 750 }] });
    const orderId: string = (createRes.body as { id: string }).id;

    const payRes = await request(app)
      .post(`/api/v1/orders/${orderId}/pay`)
      .send({ method: 'card', reference: 'TXN-12345' });

    expect(payRes.status).toBe(201);
    expect(payRes.body.payment).toMatchObject({
      orderId,
      amountCents: 1500,
      method: 'card',
      reference: 'TXN-12345',
      status: 'completed',
    });
    expect(payRes.body.order.status).toBe('paid');
  });

  it('returns 409 when order is already paid', async () => {
    const productId = await getFirstProductId();
    await stockProduct(productId, 10);

    const createRes = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ productId, quantity: 1, unitPriceCents: 100 }] });
    const orderId: string = (createRes.body as { id: string }).id;

    await request(app).post(`/api/v1/orders/${orderId}/pay`).send({ method: 'cash' });

    const res = await request(app).post(`/api/v1/orders/${orderId}/pay`).send({ method: 'cash' });
    expect(res.status).toBe(409);
  });

  it('lists payments for an order via GET /orders/:id/payments', async () => {
    const productId = await getFirstProductId();
    await stockProduct(productId, 10);

    const createRes = await request(app)
      .post('/api/v1/orders')
      .send({ items: [{ productId, quantity: 1, unitPriceCents: 100 }] });
    const orderId: string = (createRes.body as { id: string }).id;

    await request(app).post(`/api/v1/orders/${orderId}/pay`).send({ method: 'bank_transfer' });

    const paymentsRes = await request(app).get(`/api/v1/orders/${orderId}/payments`);
    expect(paymentsRes.status).toBe(200);
    expect(paymentsRes.body).toHaveLength(1);
    expect(paymentsRes.body[0]).toMatchObject({ method: 'bank_transfer', status: 'completed' });
  });
});
