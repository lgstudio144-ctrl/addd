import request from 'supertest';
import { createApp } from '../src/app';
import { store } from '../src/store';
import { _clearRateLimiter } from '../src/rateLimiter';

const app = createApp();

beforeEach(() => {
  store._clear();
  _clearRateLimiter();
});

describe('POST /api/v1/auth/register', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'a@b.com', password: 'password1' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantId: 't1', email: 'notanemail', password: 'password1' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantId: 't1', email: 'a@b.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('creates a user and returns 201 with user (no token when JWT_SECRET unset)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantId: 't1', email: 'alice@example.com', password: 'supersecret' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      tenantId: 't1',
      email: 'alice@example.com',
      role: 'staff',
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user).toHaveProperty('id');
  });

  it('assigns the admin role when requested', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantId: 't1', email: 'admin@example.com', password: 'supersecret', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('admin');
  });

  it('defaults to staff for an unrecognised role', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantId: 't1', email: 'x@y.com', password: 'supersecret', role: 'superadmin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('staff');
  });

  it('returns 409 when email is already registered', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantId: 't1', email: 'dup@example.com', password: 'supersecret' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantId: 't1', email: 'dup@example.com', password: 'supersecret' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ tenantId: 't1', email: 'bob@example.com', password: 'mypassword' });
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'bob@example.com' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'mypassword' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bob@example.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('returns 200 with user when credentials are correct', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bob@example.com', password: 'mypassword' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'bob@example.com', tenantId: 't1' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });
});
