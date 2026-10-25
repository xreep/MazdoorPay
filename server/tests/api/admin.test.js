import crypto from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { useTestDb } from '../helpers/db.js';
import {
  app,
  authed,
  cookieValue,
  createAdminUser,
  registerContractor,
  DEFAULT_PASSWORD,
} from '../helpers/factory.js';
import { ledgerFixture } from '../helpers/ledgerFixture.js';
import { Attendance } from '../../src/models/Attendance.js';
import { Payment } from '../../src/models/Payment.js';
import { Worker } from '../../src/models/Worker.js';
import { User } from '../../src/models/User.js';

useTestDb();

let admin;
let fx;
beforeEach(async () => {
  admin = { ...(await createAdminUser()) };
  admin.api = authed(admin.token);
  fx = await ledgerFixture();
});

const ROUTES = [
  '/api/v1/admin/overview',
  '/api/v1/admin/growth',
  '/api/v1/admin/users',
  '/api/v1/admin/activity',
  '/api/v1/admin/anomalies',
  '/api/v1/admin/kpis',
];

it('contractors get 403 on every admin route', async () => {
  for (const url of ROUTES) expect((await fx.api.get(url)).status).toBe(403);
  expect((await fx.api.get(`/api/v1/admin/users/${fx.user._id}`)).status).toBe(403);
  expect(
    (await fx.api.post(`/api/v1/admin/users/${fx.user._id}/suspend`, { reason: 'Testing it' }))
      .status
  ).toBe(403);
});

it('overview totals match the data', async () => {
  const other = await registerContractor();
  await User.updateOne({ _id: other.user._id }, { status: 'suspended' });
  const res = await admin.api.get('/api/v1/admin/overview');
  expect(res.status).toBe(200);
  expect(res.body.totals).toEqual({
    contractors: 2,
    activeContractors: 1,
    suspendedContractors: 1,
    workers: 2,
    activeWorkers: 2,
    sites: 2,
    attendanceRecords: 9,
    payments: 2,
    totalPaid: 40000,
  });
  expect(res.body.engagement).toEqual({ active7d: 2, active30d: 2 });
});

it('growth returns the requested number of weeks', async () => {
  const res = await admin.api.get('/api/v1/admin/growth?weeks=4');
  expect(res.status).toBe(200);
  expect(res.body.weeks).toHaveLength(4);
  const last = res.body.weeks.at(-1);
  expect(last.newContractors).toBe(1);
  expect(last.newWorkers).toBe(2);
  expect(res.body.weeks.every((w) => typeof w.weekStart === 'string')).toBe(true);
  expect((await admin.api.get('/api/v1/admin/growth?weeks=53')).status).toBe(400);
});

describe('users', () => {
  it('lists users with counts and never passwordHash', async () => {
    const res = await admin.api.get('/api/v1/admin/users?role=contractor');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      email: fx.user.email,
      sites: 2,
      workers: 2,
      status: 'active',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
    expect(
      (
        await admin.api.get(
          `/api/v1/admin/users?q=${encodeURIComponent(fx.user.email.slice(0, 8))}`
        )
      ).body.total
    ).toBe(1);
  });

  it('user detail shows read-only stats', async () => {
    const res = await admin.api.get(`/api/v1/admin/users/${fx.user._id}`);
    expect(res.status).toBe(200);
    expect(res.body.sites).toHaveLength(2);
    expect(res.body.stats).toEqual({
      workers: 2,
      activeWorkers: 2,
      attendanceRecords: 9,
      payments: 2,
      totalPaid: 40000,
      pendingDues: 257500,
      advanceOutstanding: 0,
    });
    expect(
      (await admin.api.get(`/api/v1/admin/users/${new mongoose.Types.ObjectId()}`)).status
    ).toBe(404);
  });

  it('suspension cuts off the access token and refresh; reactivation restores login', async () => {
    const login = await request(app())
      .post('/api/v1/auth/login')
      .send({ email: fx.user.email, password: DEFAULT_PASSWORD });
    const raw = cookieValue(login);
    const res = await admin.api.post(`/api/v1/admin/users/${fx.user._id}/suspend`, {
      reason: 'Fake worker entries',
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      status: 'suspended',
      suspendedReason: 'Fake worker entries',
    });
    expect((await fx.api.get('/api/v1/sites')).status).toBe(401);
    expect(
      (await request(app()).post('/api/v1/auth/refresh').set('Cookie', `mp_rt=${raw}`)).status
    ).toBe(401);

    const back = await admin.api.post(`/api/v1/admin/users/${fx.user._id}/reactivate`);
    expect(back.body.user.status).toBe('active');
    const again = await request(app())
      .post('/api/v1/auth/login')
      .send({ email: fx.user.email, password: DEFAULT_PASSWORD });
    expect(again.status).toBe(200);
    const actions = (
      await admin.api.get(`/api/v1/admin/activity?contractorId=${fx.user._id}&action=admin.suspend`)
    ).body.data;
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      action: 'admin.suspend',
      actor: { name: 'Platform Admin' },
    });
  });

  it('admins cannot suspend themselves or other admins', async () => {
    const other = await createAdminUser();
    for (const id of [admin.user._id, other.user._id]) {
      const res = await admin.api.post(`/api/v1/admin/users/${id}/suspend`, {
        reason: 'Not allowed',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Admins cannot be suspended here');
    }
    expect(
      (await admin.api.post(`/api/v1/admin/users/${fx.user._id}/suspend`, { reason: 'x' })).status
    ).toBe(400);
  });
});

it('activity filters by action and contractor', async () => {
  const all = await admin.api.get(`/api/v1/admin/activity?contractorId=${fx.user._id}`);
  expect(all.status).toBe(200);
  expect(all.body.total).toBeGreaterThanOrEqual(5);
  const sites = await admin.api.get(
    `/api/v1/admin/activity?contractorId=${fx.user._id}&action=site.create`
  );
  expect(sites.body.total).toBe(2);
  expect(sites.body.data[0].actor).toMatchObject({ name: 'Ravi Kumar', role: 'contractor' });
  const none = await admin.api.get(
    `/api/v1/admin/activity?action=site.create&from=2020-01-01&to=2020-01-31`
  );
  expect(none.body.total).toBe(0);
});

describe('anomalies', () => {
  it('a clean dataset has none', async () => {
    const res = await admin.api.get('/api/v1/admin/anomalies');
    expect(res.status).toBe(200);
    expect(res.body.anomalies).toEqual([]);
  });

  it('detects each anomaly type', async () => {
    const c = fx.user._id;
    // Worker deactivated, then attendance slipped in afterwards.
    await Worker.updateOne({ _id: fx.w2._id }, { isActive: false, deactivatedOn: '2026-10-21' });
    // Attendance before joining.
    await Attendance.create({
      contractorId: c,
      workerId: fx.w1._id,
      siteId: fx.s1._id,
      day: '2026-09-15',
      status: 'present',
      rateSnapshot: 45000,
      earned: 45000,
      markedBy: c,
    });
    // Worker without a site and a duplicate pair.
    const base = {
      contractorId: c,
      role: 'helper',
      dailyRate: 40000,
      joinedOn: '2026-10-01',
      rateHistory: [{ rate: 40000, effectiveFrom: '2026-10-01' }],
    };
    await Worker.create([
      { ...base, name: 'Lonely Worker', siteId: null },
      { ...base, name: 'Raju Das', phone: '9811111111', siteId: fx.s1._id },
      { ...base, name: 'raju das', phone: '9811111111', siteId: fx.s1._id },
    ]);
    // Wage payments above earnings and a UPI payment with no UTR.
    const pay = (extra) => ({
      contractorId: c,
      workerId: fx.w2._id,
      siteId: fx.s2._id,
      day: '2026-10-20',
      type: 'wage',
      method: 'cash',
      recordedBy: c,
      idempotencyKey: crypto.randomUUID(),
      ...extra,
    });
    await Payment.insertMany([
      pay({ amount: 90000 }),
      pay({ amount: 100, method: 'upi', type: 'advance' }),
    ]);

    const res = await admin.api.get('/api/v1/admin/anomalies');
    expect(res.body.counts).toEqual({
      attendance_inactive_worker: 1,
      attendance_before_join: 1,
      wage_payment_exceeds_earnings: 1,
      upi_without_reference: 1,
      worker_without_site: 1,
      possible_duplicate_worker: 1,
    });
    const byType = Object.fromEntries(res.body.anomalies.map((x) => [x.type, x]));
    expect(byType.attendance_inactive_worker).toMatchObject({
      workerId: fx.w2._id,
      day: '2026-10-25',
    });
    expect(byType.attendance_before_join).toMatchObject({ workerId: fx.w1._id, day: '2026-09-15' });
    expect(byType.wage_payment_exceeds_earnings).toMatchObject({ workerId: fx.w2._id });
    expect(byType.upi_without_reference.paymentId).toEqual(expect.any(String));
    expect(byType.possible_duplicate_worker.detail).toMatch(/raju das/i);
    for (const x of res.body.anomalies) expect(x.contractorId).toBe(c);
  });
});

describe('KPIs', () => {
  it('computes engagement and accuracy percentages', async () => {
    const c = fx.user._id;
    await Payment.create({
      contractorId: c,
      workerId: fx.w1._id,
      siteId: fx.s1._id,
      day: '2026-10-21',
      amount: 100,
      type: 'advance',
      method: 'upi',
      recordedBy: c,
      idempotencyKey: crypto.randomUUID(),
    });
    await Payment.create({
      contractorId: c,
      workerId: fx.w1._id,
      siteId: fx.s1._id,
      day: '2026-10-21',
      amount: 100,
      type: 'advance',
      method: 'bank',
      reference: 'NEFT-1',
      recordedBy: c,
      idempotencyKey: crypto.randomUUID(),
    });
    await registerContractor();
    const res = await admin.api.get('/api/v1/admin/kpis');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      contractors: 2,
      activeContractors7d: 2,
      activeContractors30d: 2,
      engagementRate7d: 100,
      workersManaged: 2,
      attendanceRecords: 9,
      paymentAccuracyPct: 75,
      digitalReferencePct: 50,
    });
    const csv = await admin.api.get('/api/v1/admin/kpis?format=csv');
    expect(csv.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(csv.text).toMatch(/Metric,Value\r\n/);
    expect(csv.text).toMatch(/Payment accuracy \(%\),75/);
  });
});
