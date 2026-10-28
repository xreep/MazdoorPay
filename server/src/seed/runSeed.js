import bcrypt from 'bcryptjs';
import { addDays, dayOfWeek, diffDays, eachDay, todayIST } from '@mazdoorpay/shared';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { Site } from '../models/Site.js';
import { Worker } from '../models/Worker.js';
import { Attendance } from '../models/Attendance.js';
import { Payment } from '../models/Payment.js';
import { AuditLog } from '../models/AuditLog.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { LoginAttempt } from '../models/LoginAttempt.js';
import mongoose from 'mongoose';
import { recordAudit } from '../services/audit.service.js';
import { createSite } from '../services/site.service.js';
import { changeRate, createWorker } from '../services/worker.service.js';
import { markAttendance } from '../services/attendance.service.js';
import { recordPayment, voidPayment } from '../services/payment.service.js';
import { getBalances } from '../services/ledger.service.js';
import { ADMIN, ADVANCE_NOTES, CONTRACTORS, PAYMENT_NOTES, WORKERS } from './data.js';

const SEED = 20261025;
const HISTORY_DAYS = 45;
const JOINED_DAYS_AGO = 60;
const RAISE_DAYS_AGO = 20;
const SATURDAY = 6;
const SUNDAY = 0;

// mulberry32: small deterministic PRNG so every seed run produces the same data.
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function removeDemoData() {
  // Clear the "finished" marker first, so a removal cut short is redone by the next start.
  await seedMarker().deleteOne({ _id: 'demo-seed' });
  const demo = await User.find({ isDemo: true }).select('_id email').lean();
  const ids = demo.map((u) => u._id);
  const owned = { contractorId: { $in: ids } };
  await Promise.all([
    Payment.deleteMany(owned),
    Attendance.deleteMany(owned),
    Worker.deleteMany(owned),
    Site.deleteMany(owned),
    AuditLog.deleteMany({ $or: [owned, { actorId: { $in: ids } }] }),
    RefreshToken.deleteMany({ userId: { $in: ids } }),
    LoginAttempt.deleteMany({ email: { $in: demo.map((u) => u.email) } }),
  ]);
  await User.deleteMany({ _id: { $in: ids } });
}

// Written only when a seed run finishes, so an interrupted run is detected and redone.
const seedMarker = () => mongoose.connection.collection('seedstate');

/**
 * Replaces the demo accounts and their data. Real users are never touched.
 * Everything is written through the services so every business rule holds.
 * `now` fixes the calendar of the demo data; it must not be in the future.
 */
export async function runSeed({ now = new Date(), log = () => {}, allowProd = false } = {}) {
  if (config.isProd && !allowProd && process.env.SEED_ALLOW_PROD !== 'true') {
    throw new Error(
      'Refusing to seed production. Set SEED_ALLOW_PROD=true to replace the demo accounts.'
    );
  }
  if (!config.demoPassword || !config.demoAdminPassword) {
    throw new Error('Set DEMO_PASSWORD and DEMO_ADMIN_PASSWORD to create the demo accounts.');
  }
  const random = prng(SEED);
  const pickIndex = (n) => Math.floor(random() * n);
  const uuid = () => {
    const hex = Array.from({ length: 32 }, () => pickIndex(16).toString(16)).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
  };
  const utr = () =>
    `${1 + pickIndex(9)}${Array.from({ length: 11 }, () => pickIndex(10)).join('')}`;

  await removeDemoData();
  log('Removed previous demo data');

  const today = todayIST(now);
  const joinedOn = addDays(today, -JOINED_DAYS_AGO);
  const days = eachDay(addDays(today, -HISTORY_DAYS), addDays(today, -1));
  const raiseDay = addDays(today, -RAISE_DAYS_AGO);
  const realToday = todayIST();
  const reasonFor = (day) =>
    diffDays(day, realToday) > 7 ? 'Entered from the site attendance register' : undefined;

  await User.create({
    ...ADMIN,
    passwordHash: await bcrypt.hash(config.demoAdminPassword, config.bcryptCost),
    role: 'admin',
    isDemo: true,
  });
  const passwordHash = await bcrypt.hash(config.demoPassword, config.bcryptCost);

  let workerCursor = 0;
  const tenants = [];
  for (const c of CONTRACTORS) {
    const user = await User.create({
      name: c.name,
      email: c.email,
      phone: c.phone,
      passwordHash,
      role: 'contractor',
      isDemo: true,
    });
    const ctx = {
      actor: { id: String(user._id), role: 'contractor' },
      contractorId: String(user._id),
      ip: '127.0.0.1',
    };
    await recordAudit({ ...ctx, action: 'auth.register', entity: 'User', entityId: user._id });
    const sites = [];
    for (const s of c.sites) sites.push(await createSite(ctx, s));

    const workers = [];
    for (let i = 0; i < c.workerCount; i++, workerCursor++) {
      const w = WORKERS[workerCursor];
      const first = w.name.split(' ')[0].toLowerCase();
      workers.push(
        await createWorker(ctx, {
          name: w.name,
          role: w.role,
          dailyRate: w.rate * 100,
          phone: `9${String(700000000 + workerCursor * 7919373).slice(-9)}`,
          upiId: workerCursor % 3 === 0 ? `${first}${workerCursor + 10}@oksbi` : undefined,
          siteId: String(sites[i % sites.length]._id),
          preferredLanguage: workerCursor % 2 ? 'hi' : 'en',
          joinedOn,
        })
      );
    }
    tenants.push({ ctx, workers });
  }
  log(`Created ${tenants.length} contractors and ${workerCursor} workers`);

  // Three workers get a raise; the rest keep their joining rate.
  const raises = [
    [tenants[0], 2, 105000],
    [tenants[0], 5, 112000],
    [tenants[1], 3, 104000],
  ];
  const advances = new Map([
    [days[9], [tenants[0], 0, 100000]],
    [days[17], [tenants[0], 10, 50000]],
    [days[24], [tenants[1], 4, 150000]],
    [days[33], [tenants[1], 9, 80000]],
  ]);
  const lastSaturday = days.filter((d) => dayOfWeek(d) === SATURDAY).at(-1);

  for (const day of days) {
    if (day === raiseDay) {
      for (const [tenant, index, rate] of raises) {
        await changeRate(tenant.ctx, String(tenant.workers[index]._id), {
          dailyRate: rate,
          effectiveFrom: raiseDay,
        });
      }
    }
    for (const { ctx, workers } of tenants) {
      const records = workers.map((w) => {
        const r = random();
        let status;
        if (dayOfWeek(day) === SUNDAY) status = r < 0.85 ? 'absent' : 'present';
        else status = r < 0.8 ? 'present' : r < 0.9 ? 'half-day' : 'absent';
        return { workerId: String(w._id), status };
      });
      await markAttendance({ ...ctx, day, records, reason: reasonFor(day) });
    }

    const advance = advances.get(day);
    if (advance) {
      const [tenant, index, amount] = advance;
      await recordPayment({
        ...tenant.ctx,
        input: {
          workerId: String(tenant.workers[index]._id),
          amount,
          type: 'advance',
          method: 'cash',
          notes: ADVANCE_NOTES[[...advances.keys()].indexOf(day)],
          day,
          idempotencyKey: uuid(),
        },
      });
    }

    if (dayOfWeek(day) !== SATURDAY) continue;
    for (const { ctx, workers } of tenants) {
      const balances = await getBalances(ctx.contractorId, {
        workerIds: workers.map((w) => w._id),
      });
      let corrected = null;
      if (day === lastSaturday && ctx === tenants[0].ctx) {
        // One mistyped entry, voided and re-entered — the audit trail shows both.
        corrected = workers.reduce((best, w) =>
          balances.get(String(w._id)).balance > balances.get(String(best._id)).balance ? w : best
        );
        const wrong = await recordPayment({
          ...ctx,
          input: {
            workerId: String(corrected._id),
            amount: 450000,
            // Depending on the calendar the dues may be lower; an advance is always allowed.
            type: balances.get(String(corrected._id)).balance >= 450000 ? 'wage' : 'advance',
            method: 'cash',
            day,
            idempotencyKey: uuid(),
          },
        });
        await voidPayment({
          ...ctx,
          paymentId: String(wrong.payment._id),
          reason: 'Entered ₹4,500 instead of ₹450',
        });
        await recordPayment({
          ...ctx,
          input: {
            workerId: String(corrected._id),
            amount: 45000,
            type: 'wage',
            method: 'cash',
            notes: 'Part payment',
            day,
            idempotencyKey: uuid(),
          },
        });
      }
      for (const w of workers) {
        const due = balances.get(String(w._id)).balance;
        if (w === corrected || due <= 0 || random() < 0.2) continue;
        const upi = random() < 0.4;
        await recordPayment({
          ...ctx,
          input: {
            workerId: String(w._id),
            amount: due,
            type: 'wage',
            method: upi ? 'upi' : 'cash',
            reference: upi ? utr() : undefined,
            notes: PAYMENT_NOTES[pickIndex(PAYMENT_NOTES.length)] || undefined,
            day,
            idempotencyKey: uuid(),
          },
        });
      }
    }
  }

  const contractorIds = tenants.map((t) => t.ctx.contractorId);
  const scope = { contractorId: { $in: contractorIds } };
  const counts = {
    contractors: tenants.length,
    sites: await Site.countDocuments(scope),
    workers: await Worker.countDocuments(scope),
    attendance: await Attendance.countDocuments(scope),
    payments: await Payment.countDocuments(scope),
  };
  await seedMarker().updateOne(
    { _id: 'demo-seed' },
    { $set: { completedAt: new Date(), counts } },
    { upsert: true }
  );
  log(`Seeded ${JSON.stringify(counts)}`);
  return counts;
}

const LOCK_ID = 'demo-seed-lock';
// A seed takes well under a minute; a lock older than this belongs to an instance that died.
const LOCK_MS = 10 * 60 * 1000;

async function acquireSeedLock() {
  const until = new Date(Date.now() + LOCK_MS);
  try {
    await seedMarker().insertOne({ _id: LOCK_ID, until });
    return true;
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
  const abandoned = await seedMarker().findOneAndUpdate(
    { _id: LOCK_ID, until: { $lt: new Date() } },
    { $set: { until } }
  );
  return Boolean(abandoned);
}

const seeded = async () => Boolean(await seedMarker().findOne({ _id: 'demo-seed' }));

// For hosts without a shell (Render free tier): create the demo accounts on first start only.
// During a deploy the old and new instances both start this; the lock lets only one seed.
// Returns the counts when it seeded, or null when the demo data exists or is being created.
export async function seedDemoIfMissing({ now = new Date(), log = () => {} } = {}) {
  if (await seeded()) return null;
  if (!(await acquireSeedLock())) {
    log('Another instance is creating the demo data');
    return null;
  }
  try {
    if (await seeded()) return null;
    return await runSeed({ now, log, allowProd: true });
  } finally {
    await seedMarker().deleteOne({ _id: LOCK_ID });
  }
}

// Changing DEMO_PASSWORD or DEMO_ADMIN_PASSWORD on the host takes effect on the next start: the
// existing demo accounts get the new passwords and their sessions end. Real accounts are untouched.
// Returns how many accounts changed.
export async function syncDemoPasswords({ log = () => {} } = {}) {
  if (!config.demoPassword || !config.demoAdminPassword) return 0;
  const demo = await User.find({ isDemo: true }).select('+passwordHash role email');
  let changed = 0;
  for (const user of demo) {
    const wanted = user.role === 'admin' ? config.demoAdminPassword : config.demoPassword;
    if (await bcrypt.compare(wanted, user.passwordHash)) continue;
    user.passwordHash = await bcrypt.hash(wanted, config.bcryptCost);
    await user.save();
    await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
    await LoginAttempt.deleteOne({ email: user.email });
    changed += 1;
  }
  if (changed) log(`New password set on ${changed} demo account(s)`);
  return changed;
}
