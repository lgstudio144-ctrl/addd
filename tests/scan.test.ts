import request from 'supertest';
import { createApp } from '../src/app';
import { store } from '../src/store';

const app = createApp();

beforeEach(() => store._clear());

describe('POST /api/v1/scan — barcode string', () => {
  it('returns 400 when no barcode and no image are provided', async () => {
    const res = await request(app).post('/api/v1/scan').send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 with the barcode when no product is registered for it', async () => {
    const res = await request(app).post('/api/v1/scan').send({ barcode: 'UNKNOWN-99' });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('barcode', 'UNKNOWN-99');
  });

  it('returns the product when the barcode is registered', async () => {
    store.createProduct('SCAN-01', 'Tequila');
    const res = await request(app).post('/api/v1/scan').send({ barcode: 'SCAN-01' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ barcode: 'SCAN-01' });
    expect(res.body.product).toMatchObject({ name: 'Tequila' });
  });

  it('includes currentLocation in the response', async () => {
    const p = store.createProduct('SCAN-02', 'Brandy');
    store.recordPlacement(p.id, 'bar');
    const res = await request(app).post('/api/v1/scan').send({ barcode: 'SCAN-02' });
    expect(res.status).toBe(200);
    expect(res.body.currentLocation).toBe('bar');
  });
});
