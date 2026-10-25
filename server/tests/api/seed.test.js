import { User } from '../../src/models/User.js';
import { Worker } from '../../src/models/Worker.js';
import { Attendance } from '../../src/models/Attendance.js';
import { Payment } from '../../src/models/Payment.js';
import { config } from '../../src/config/env.js';
import { runSeed } from '../../src/seed/runSeed.js';
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
    .send({ email: 'ravi.kumar@mazdoorpay.in', password: 'Demo@2026' });
  expect(login.status).toBe(200);
  const admin = await request(app())
    .post('/api/v1/auth/login')
    .send({ email: 'admin@mazdoorpay.in', password: 'Admin@2026' });
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
