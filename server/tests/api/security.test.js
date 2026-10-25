import crypto from 'node:crypto';
import request from 'supertest';
import { useTestDb } from '../helpers/db.js';
import { app, authed, registerContractor, DEFAULT_PASSWORD } from '../helpers/factory.js';
import { ledgerFixture } from '../helpers/ledgerFixture.js';
import { createApp } from '../../src/app.js';

useTestDb();

describe('cross-tenant matrix', () => {
  it("contractor B gets 404 on every route that names A's ids, and nothing leaks", async () => {
    const fx = await ledgerFixture();
    const pay = await fx.api.post('/api/v1/payments', {
      workerId: fx.w1._id,
      amount: 100,
      type: 'advance',
      method: 'cash',
      idempotencyKey: crypto.randomUUID(),
    });
    const paymentId = pay.body.payment._id;
    const other = authed((await registerContractor()).token);
    const site = fx.s1._id;
    const worker = fx.w1._id;

    const cases = [
      ['get', `/api/v1/sites/${site}`],
      ['patch', `/api/v1/sites/${site}`, { name: 'Taken over' }],
      ['del', `/api/v1/sites/${site}`],
      ['get', `/api/v1/workers/${worker}`],
      ['get', `/api/v1/workers/${worker}/summary`],
      ['patch', `/api/v1/workers/${worker}`, { name: 'Taken over' }],
      ['post', `/api/v1/workers/${worker}/rate`, { dailyRate: 90000 }],
      ['post', `/api/v1/workers/${worker}/deactivate`],
      ['post', `/api/v1/workers/${worker}/reactivate`],
      [
        'post',
        '/api/v1/workers',
        { name: 'Sneaky', role: 'helper', dailyRate: 40000, siteId: site },
      ],
      ['get', `/api/v1/attendance/sheet?siteId=${site}`],
      ['get', `/api/v1/attendance/calendar?siteId=${site}&month=2026-10`],
      ['get', `/api/v1/payments/${paymentId}`],
      ['post', `/api/v1/payments/${paymentId}/void`, { reason: 'Not mine' }],
      [
        'post',
        '/api/v1/payments',
        {
          workerId: worker,
          amount: 100,
          type: 'advance',
          method: 'cash',
          idempotencyKey: crypto.randomUUID(),
        },
      ],
      ['get', `/api/v1/payments/dues?siteId=${site}`],
      ['get', `/api/v1/wages/summary?from=2026-10-01&to=2026-10-31&siteId=${site}`],
      ['get', `/api/v1/reports/attendance?from=2026-10-01&to=2026-10-31&siteId=${site}`],
      ['get', `/api/v1/reports/muster-roll?month=2026-10&siteId=${site}`],
      ['get', `/api/v1/reports/wage-register?from=2026-10-01&to=2026-10-31&siteId=${site}`],
      ['get', `/api/v1/reports/payments?from=2026-10-01&to=2026-10-31&siteId=${site}`],
    ];
    for (const [method, url, body] of cases) {
      const res = await other[method](url, body);
      expect([url, res.status]).toEqual([url, 404]);
      expect(JSON.stringify(res.body)).not.toMatch(/Ramesh|Prestige/);
    }

    const marked = await other.put('/api/v1/attendance', {
      day: '2026-10-20',
      records: [{ workerId: worker, status: 'present' }],
      reason: 'Trying it',
    });
    expect(marked.body).toEqual({
      saved: 0,
      unchanged: 0,
      errors: [{ workerId: worker, error: 'Worker not found' }],
    });

    // A's data is untouched.
    expect((await fx.api.get(`/api/v1/sites/${site}`)).body.site.name).toBe('Prestige Lakeside');
    expect((await fx.api.get(`/api/v1/payments/${paymentId}`)).body.payment.voidedAt).toBeNull();
  });
});

describe('request hardening', () => {
  it('rejects NoSQL operator payloads on login', async () => {
    const res = await request(app())
      .post('/api/v1/auth/login')
      .send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });

  it('rejects garbage bearer tokens', async () => {
    const res = await request(app())
      .get('/api/v1/dashboard')
      .set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Please log in again' });
  });

  it('does not allow CORS from unknown origins but does from the frontend', async () => {
    const evil = await request(app())
      .options('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
    const good = await request(app())
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    expect(good.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(good.headers['access-control-allow-credentials']).toBe('true');
  });

  it('sends security headers and hides the framework', async () => {
    const res = await request(app()).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('rate-limits the auth routes', async () => {
    const limited = createApp({ authRateLimitMax: 3 });
    const attempt = () =>
      request(limited)
        .post('/api/v1/auth/login')
        .send({ email: 'x@example.com', password: DEFAULT_PASSWORD });
    for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many requests/);
  });

  it('refresh and me are not counted by the strict auth limiter', async () => {
    const limited = createApp({ authRateLimitMax: 2 });
    for (let i = 0; i < 5; i++)
      expect((await request(limited).post('/api/v1/auth/refresh')).status).toBe(401);
    for (let i = 0; i < 5; i++)
      expect((await request(limited).get('/api/v1/auth/me')).status).toBe(401);
  });

  it('trust proxy is configurable', () => {
    expect(createApp({ trustProxy: 2 }).get('trust proxy')).toBe(2);
  });

  it('errors never include stack traces', async () => {
    const res = await request(app())
      .post('/api/v1/auth/login')
      .set('content-type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js/);
  });
});
