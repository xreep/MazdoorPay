import mongoose from 'mongoose';
import { User } from '../../src/models/User.js';
import { Worker } from '../../src/models/Worker.js';
import { Attendance } from '../../src/models/Attendance.js';
import { Payment } from '../../src/models/Payment.js';
import { config } from '../../src/config/env.js';
import { runSeed, seedDemoIfMissing, syncDemoPasswords } from '../../src/seed/runSeed.js';
import { RefreshToken } from '../../src/models/RefreshToken.js';
import { findAnomalies } from '../../src/services/admin.service.js';
import { useTestDb } from '../helpers/db.js';
import { registerContractor } from '../helpers/factory.js';
import request from 'supertest';
import { app } from '../helpers/factory.js';

useTestDb();

const NOW = new Date('2026-10-25T06:00:00Z');

it('creates realistic demo data, keeps real users and passes every data check', async () => {
  const real = await registerContractor({ name: 'Real Customer' });
  const counts = await runSeed({ now: NOW });
  expect(counts).toMatchObject({ contractors: 2, sites: 4, workers: 30, attendance: 30 * 45 });
  expect(counts.payments).toBeGreaterThan(100);

  expect(await Attendance.countDocuments({ contractorId: { $ne: real.user._id } })).toBe(1350);
  expect(
    await Payment.countDocuments({
      voidedAt: { $ne: null },
      voidReason: 'Entered ₹4,500 instead of ₹450',
    })
  ).toBe(1);
  expect(await Payment.countDocuments({ type: 'advance', voidedAt: null })).toBe(4);
  const raised = await Worker.find({ 'rateHistory.1': { $exists: true } }).lean();
  expect(raised).toHaveLength(3);
  expect(await Payment.countDocuments({ method: 'upi', reference: { $not: /^\d{12}$/ } })).toBe(0);
  expect((await findAnomalies()).anomalies).toEqual([]);

  const again = await runSeed({ now: NOW });
  expect(again).toEqual(counts);
  expect(await User.exists({ _id: real.user._id })).toBeTruthy();
  expect(await User.countDocuments({ isDemo: true })).toBe(3);

  const login = await request(app())
    .post('/api/v1/auth/login')
    .send({ email: 'ravi.kumar@mazdoorpay.in', password: config.demoPassword });
  expect(login.status).toBe(200);
  const admin = await request(app())
    .post('/api/v1/auth/login')
    .send({ email: 'admin@mazdoorpay.in', password: config.demoAdminPassword });
  expect(admin.body.user.role).toBe('admin');
}, 120000);

it('refuses to run in production without SEED_ALLOW_PROD', async () => {
  const wasProd = config.isProd;
  config.isProd = true;
  try {
    await expect(runSeed({ now: NOW })).rejects.toThrow(/SEED_ALLOW_PROD/);
  } finally {
    config.isProd = wasProd;
  }
});

it('seedDemoIfMissing seeds once, even in production, and then leaves the data alone', async () => {
  const wasProd = config.isProd;
  config.isProd = true;
  try {
    const first = await seedDemoIfMissing({ now: NOW });
    expect(first).toMatchObject({ contractors: 2, workers: 30 });
    const paymentsBefore = await Payment.countDocuments();
    expect(await seedDemoIfMissing({ now: NOW })).toBeNull();
    expect(await Payment.countDocuments()).toBe(paymentsBefore);
  } finally {
    config.isProd = wasProd;
  }
}, 120000);

it('seedDemoIfMissing redoes a seed that was interrupted part-way', async () => {
  // A restart mid-seed leaves demo users behind without the "finished" marker.
  await User.create({
    name: 'Half Seeded',
    email: 'ravi.kumar@mazdoorpay.in',
    passwordHash: 'x',
    role: 'contractor',
    isDemo: true,
  });
  const counts = await seedDemoIfMissing({ now: NOW });
  expect(counts).toMatchObject({ contractors: 2, workers: 30, attendance: 1350 });
  expect(await seedDemoIfMissing({ now: NOW })).toBeNull();
}, 120000);

it('seedDemoIfMissing seeds only once when two instances start together', async () => {
  // Render starts the new instance while the old one is still running.
  const results = await Promise.all([
    seedDemoIfMissing({ now: NOW }),
    seedDemoIfMissing({ now: NOW }),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(await User.countDocuments({ isDemo: true })).toBe(3);
  expect(await Worker.countDocuments()).toBe(30);
}, 120000);

it('seedDemoIfMissing waits out a live lock but takes over an abandoned one', async () => {
  const state = mongoose.connection.collection('seedstate');
  await state.insertOne({ _id: 'demo-seed-lock', until: new Date(Date.now() + 60_000) });
  expect(await seedDemoIfMissing({ now: NOW })).toBeNull();
  expect(await User.countDocuments({ isDemo: true })).toBe(0);

  await state.updateOne({ _id: 'demo-seed-lock' }, { $set: { until: new Date(Date.now() - 1) } });
  expect(await seedDemoIfMissing({ now: NOW })).toMatchObject({ contractors: 2 });
  expect(await state.findOne({ _id: 'demo-seed-lock' })).toBeNull();
}, 120000);

describe('demo passwords', () => {
  const login = (email, password) =>
    request(app()).post('/api/v1/auth/login').send({ email, password });

  it('the seed refuses to run without them', async () => {
    const saved = config.demoPassword;
    config.demoPassword = undefined;
    try {
      await expect(runSeed({ now: NOW })).rejects.toThrow(/DEMO_PASSWORD/);
      expect(await User.countDocuments({ isDemo: true })).toBe(0);
    } finally {
      config.demoPassword = saved;
    }
  });

  it('new ones replace the old on the existing demo accounts, ending their sessions', async () => {
    await runSeed({ now: NOW });
    const real = await registerContractor();
    const before = await login('ravi.kumar@mazdoorpay.in', config.demoPassword);
    expect(before.status).toBe(200);
    expect(await syncDemoPasswords()).toBe(0); // already current

    const saved = { demo: config.demoPassword, admin: config.demoAdminPassword };
    config.demoPassword = 'Rotated-demo-2026';
    config.demoAdminPassword = 'Rotated-admin-2026';
    try {
      expect(await syncDemoPasswords()).toBe(3);
      expect((await login('ravi.kumar@mazdoorpay.in', saved.demo)).status).toBe(401);
      expect((await login('admin@mazdoorpay.in', saved.admin)).status).toBe(401);
      expect((await login('sunita.patil@mazdoorpay.in', 'Rotated-demo-2026')).status).toBe(200);
      expect((await login('admin@mazdoorpay.in', 'Rotated-admin-2026')).status).toBe(200);
      // The session that logged in with the old password is over.
      const ravi = await User.findOne({ email: 'ravi.kumar@mazdoorpay.in' });
      expect(await RefreshToken.countDocuments({ userId: ravi._id, revokedAt: null })).toBe(0);
      // Real accounts are never touched.
      expect((await login(real.user.email, real.password)).status).toBe(200);
    } finally {
      config.demoPassword = saved.demo;
      config.demoAdminPassword = saved.admin;
    }
  }, 120000);

  it('leaves the accounts alone when none are set', async () => {
    await runSeed({ now: NOW });
    const saved = config.demoPassword;
    config.demoPassword = undefined;
    try {
      expect(await syncDemoPasswords()).toBe(0);
    } finally {
      config.demoPassword = saved;
    }
    expect((await login('ravi.kumar@mazdoorpay.in', saved)).status).toBe(200);
  }, 120000);
});

it('the dashboard 30 days and Wages for the same dates agree, across two months of demo data', async () => {
  await runSeed(); // 45 days up to today, so the 30-day window spans two calendar months
  const res = await request(app())
    .post('/api/v1/auth/login')
    .send({ email: 'ravi.kumar@mazdoorpay.in', password: config.demoPassword });
  const token = res.body.accessToken;
  const get = (path) => request(app()).get(path).set('Authorization', `Bearer ${token}`);
  const { trend } = (await get('/api/v1/dashboard')).body;
  const from = trend[0].day;
  const to = trend.at(-1).day;
  expect(from.slice(0, 7)).not.toBe(to.slice(0, 7));
  const sum = (key) => trend.reduce((total, d) => total + d[key], 0);
  const wages = (await get(`/api/v1/wages/summary?from=${from}&to=${to}`)).body.totals;
  expect(wages).toMatchObject({
    present: sum('present'),
    halfDay: sum('halfDay'),
    earned: sum('earned'),
  });
  expect(sum('present')).toBeGreaterThan(100);
}, 120000);
