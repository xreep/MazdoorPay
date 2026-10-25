import request from 'supertest';
import { createApp } from '../../src/app.js';
import { useTestDb } from '../helpers/db.js';

useTestDb();

it('GET /api/v1/health reports ok and db connected', async () => {
  const res = await request(createApp()).get('/api/v1/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok', db: 'connected' });
});

it('unknown route returns JSON 404', async () => {
  const res = await request(createApp()).get('/api/v1/nope');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: 'Not found' });
});

it('rejects bodies over 100kb with 413', async () => {
  const res = await request(createApp())
    .post('/api/v1/auth/login')
    .send({ email: 'a'.repeat(110_000) });
  expect(res.status).toBe(413);
});
