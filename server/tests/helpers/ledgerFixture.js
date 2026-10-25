import crypto from 'node:crypto';
import { Attendance } from '../../src/models/Attendance.js';
import { Payment } from '../../src/models/Payment.js';
import { authed, registerContractor } from './factory.js';

const EARN = { present: 1, 'half-day': 0.5, absent: 0 };

// Two sites, two workers, fixed October 2026 days (inserted directly so future days are allowed).
export async function ledgerFixture() {
  const reg = await registerContractor({ name: 'Ravi Kumar' });
  const api = authed(reg.token);
  const s1 = (await api.post('/api/v1/sites', { name: 'Prestige Lakeside' })).body.site;
  const s2 = (await api.post('/api/v1/sites', { name: 'Sobha Tower' })).body.site;
  const w1 = (
    await api.post('/api/v1/workers', {
      name: 'Ramesh Yadav',
      role: 'mason',
      dailyRate: 45000,
      siteId: s1._id,
      joinedOn: '2026-10-01',
    })
  ).body.worker;
  const w2 = (
    await api.post('/api/v1/workers', {
      name: 'Suresh Patil',
      role: 'helper',
      dailyRate: 60000,
      siteId: s2._id,
      joinedOn: '2026-10-01',
    })
  ).body.worker;

  const row = (worker, site, day, status, rate) => ({
    contractorId: reg.user._id,
    workerId: worker._id,
    siteId: site._id,
    day,
    status,
    rateSnapshot: rate,
    earned: Math.floor(rate * EARN[status]),
    markedBy: reg.user._id,
  });
  await Attendance.insertMany([
    row(w1, s1, '2026-10-14', 'present', 45000),
    row(w1, s1, '2026-10-15', 'present', 45000),
    row(w1, s1, '2026-10-17', 'half-day', 45000),
    row(w1, s1, '2026-10-18', 'absent', 45000),
    row(w1, s1, '2026-10-19', 'present', 50000),
    row(w1, s1, '2026-10-25', 'present', 50000),
    row(w1, s1, '2026-10-26', 'half-day', 50000),
    row(w2, s2, '2026-10-20', 'present', 60000),
    row(w2, s2, '2026-10-25', 'absent', 60000),
  ]);
  const payment = (worker, site, day, amount, type, extra = {}) => ({
    contractorId: reg.user._id,
    workerId: worker._id,
    siteId: site._id,
    day,
    amount,
    type,
    method: 'cash',
    recordedBy: reg.user._id,
    idempotencyKey: crypto.randomUUID(),
    ...extra,
  });
  await Payment.insertMany([
    payment(w1, s1, '2026-10-20', 30000, 'wage'),
    payment(w1, s1, '2026-10-29', 10000, 'advance'),
    payment(w1, s1, '2026-10-21', 5000, 'wage', { voidedAt: new Date(), voidReason: 'Duplicate' }),
  ]);
  return { ...reg, api, s1, s2, w1, w2 };
}
