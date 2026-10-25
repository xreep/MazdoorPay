import crypto from 'node:crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import { addDays, todayIST } from '@mazdoorpay/shared';
import { useTestDb } from '../helpers/db.js';
import { app, authed, registerContractor } from '../helpers/factory.js';
import { AuditLog } from '../../src/models/AuditLog.js';

useTestDb();

let a;
let b;
let ramesh;
beforeEach(async () => {
  const ra = await registerContractor({ name: 'Ravi Kumar', phone: '9800000001' });
  a = { ...ra, api: authed(ra.token) };
  const rb = await registerContractor();
  b = { ...rb, api: authed(rb.token) };
  const site = (await a.api.post('/api/v1/sites', { name: 'Prestige Lakeside' })).body.site;
  ramesh = (
    await a.api.post('/api/v1/workers', {
      name: 'Ramesh Yadav',
      role: 'mason',
      dailyRate: 80000,
      siteId: site._id,
      joinedOn: addDays(todayIST(), -5),
      preferredLanguage: 'hi',
    })
  ).body.worker;
  await a.api.put('/api/v1/attendance', {
    day: addDays(todayIST(), -1),
    records: [{ workerId: ramesh._id, status: 'present' }],
  });
  await a.api.put('/api/v1/attendance', {
    day: todayIST(),
    records: [{ workerId: ramesh._id, status: 'half-day' }],
  });
  const pay = (amount, extra = {}) =>
    a.api.post('/api/v1/payments', {
      workerId: ramesh._id,
      amount,
      type: 'wage',
      method: 'cash',
      idempotencyKey: crypto.randomUUID(),
      ...extra,
    });
  const wrong = (await pay(50000)).body.payment;
  await a.api.post(`/api/v1/payments/${wrong._id}/void`, { reason: 'Entered twice by mistake' });
  await pay(30000);
});

const open = (token) => request(app()).get(`/api/v1/statements/${token}`);
const createLink = async (api = a.api) => api.post(`/api/v1/workers/${ramesh._id}/statement-link`);

describe('worker statement link', () => {
  it('shows the worker their balance, recent days and payments — and nothing else', async () => {
    const created = await createLink();
    expect(created.status).toBe(201);
    const { token, path } = created.body;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(path).toBe(`/s/${token}`);

    const res = await open(token);
    expect(res.status).toBe(200);
    expect(res.body.worker).toEqual({
      name: 'Ramesh Yadav',
      role: 'mason',
      preferredLanguage: 'hi',
    });
    expect(res.body.contractor).toEqual({ name: 'Ravi Kumar' });
    const summary = await a.api.get(`/api/v1/workers/${ramesh._id}/summary`);
    expect(res.body.balance).toEqual(summary.body.balance);
    expect(res.body.balance.balance).toBe(120000 - 30000);
    expect(res.body.days.map((d) => [d.day, d.status, d.earned])).toEqual([
      [todayIST(), 'half-day', 40000],
      [addDays(todayIST(), -1), 'present', 80000],
    ]);
    expect(res.body.payments.map((p) => [p.amount, Boolean(p.voided)])).toEqual(
      expect.arrayContaining([
        [50000, true],
        [30000, false],
      ])
    );
    expect(JSON.stringify(res.body)).not.toMatch(/9800000001|@example\.com|contractorId|_id/);
  });

  it('keeps only a hash of the token, and notes when the worker looks', async () => {
    const { token } = (await createLink()).body;
    const stored = await mongoose.connection.collection('statementlinks').findOne({});
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored.lastViewedAt ?? null).toBeNull();
    await open(token);
    const status = await a.api.get(`/api/v1/workers/${ramesh._id}/statement-link`);
    expect(status.body).toMatchObject({ active: true });
    expect(status.body.lastViewedAt).toBeTruthy();
    expect(await AuditLog.countDocuments({ action: 'statement.create' })).toBe(1);
  });

  it('a new link replaces the old one, and a stopped link stops working', async () => {
    const first = (await createLink()).body.token;
    const second = (await createLink()).body.token;
    expect((await open(first)).status).toBe(404);
    expect((await open(second)).status).toBe(200);

    expect((await a.api.del(`/api/v1/workers/${ramesh._id}/statement-link`)).status).toBe(200);
    const gone = await open(second);
    expect(gone.status).toBe(404);
    expect(gone.body.error).toMatch(/not valid any more/);
    expect((await a.api.get(`/api/v1/workers/${ramesh._id}/statement-link`)).body).toEqual({
      active: false,
    });
    expect(await AuditLog.countDocuments({ action: 'statement.revoke' })).toBe(1);
  });

  it("another contractor cannot make or stop a link for someone else's worker", async () => {
    expect((await createLink(b.api)).status).toBe(404);
    expect((await b.api.del(`/api/v1/workers/${ramesh._id}/statement-link`)).status).toBe(404);
  });

  it('answers made-up tokens the same way as stopped ones', async () => {
    for (const token of ['x', 'A'.repeat(43), 'not a token at all'])
      expect((await open(encodeURIComponent(token))).status).toBe(404);
  });
});
