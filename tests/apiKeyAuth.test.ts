import request from 'supertest';
import express from 'express';
import { apiKeyAuth } from '../src/middleware/apiKeyAuth';
import * as configModule from '../src/config';

function buildApp() {
  const app = express();
  app.use(apiKeyAuth);
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('apiKeyAuth middleware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes through when API_KEY is not configured', async () => {
    jest.replaceProperty(configModule.config, 'apiKey', '');
    const res = await request(buildApp()).get('/test');
    expect(res.status).toBe(200);
  });

  it('returns 401 when API_KEY is set but no header is provided', async () => {
    jest.replaceProperty(configModule.config, 'apiKey', 'secret');
    const res = await request(buildApp()).get('/test');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 when a wrong key is provided', async () => {
    jest.replaceProperty(configModule.config, 'apiKey', 'secret');
    const res = await request(buildApp()).get('/test').set('x-api-key', 'wrong');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('passes through when the correct key is provided', async () => {
    jest.replaceProperty(configModule.config, 'apiKey', 'secret');
    const res = await request(buildApp()).get('/test').set('x-api-key', 'secret');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
