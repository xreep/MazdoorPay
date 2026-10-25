import mongoose from 'mongoose';
import { addDays, todayIST } from '@mazdoorpay/shared';
import { Worker } from '../models/Worker.js';
import { Site } from '../models/Site.js';
import { Attendance } from '../models/Attendance.js';
import { Payment } from '../models/Payment.js';
import { User } from '../models/User.js';
import { httpError } from '../utils/httpError.js';
import { pageResult, skipFor } from '../utils/pagination.js';
import { pick, recordAudit } from './audit.service.js';
import { latestRateEntry } from './rate.js';
import { getBalance } from './ledger.service.js';

const AUDIT_FIELDS = [
  'name',
  'role',
  'dailyRate',
  'phone',
  'upiId',
  'siteId',
  'preferredLanguage',
  'joinedOn',
  'isActive',
];
const HIDDEN = '-ledgerVersion -__v';

export const serializeWorker = (worker) => {
  const {
    ledgerVersion: _l,
    __v: _v,
    ...rest
  } = typeof worker.toObject === 'function' ? worker.toObject() : worker;
  return rest;
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function findOwnedWorker(contractorId, workerId, { session } = {}) {
  const worker = await Worker.findOne({ _id: workerId, contractorId }).session(session ?? null);
  if (!worker) throw httpError(404, 'Worker not found');
  return worker;
}

async function assertOwnedSite(contractorId, siteId) {
  if (!siteId) return;
  if (!(await Site.exists({ _id: siteId, contractorId }))) throw httpError(404, 'Site not found');
}

export async function listWorkers(contractorId, { q, siteId, role, status, page, limit }) {
  const filter = { contractorId };
  if (status !== 'all') filter.isActive = status === 'active';
  if (siteId) filter.siteId = siteId;
  if (role) filter.role = role;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: pattern }, { phone: pattern }];
  }
  const [items, total] = await Promise.all([
    Worker.find(filter)
      .select(HIDDEN)
      .sort({ name: 1, _id: 1 })
      .skip(skipFor({ page, limit }))
      .limit(limit)
      .lean(),
    Worker.countDocuments(filter),
  ]);
  return pageResult(items, total, { page, limit });
}

export async function getWorker(contractorId, workerId) {
  const worker = await findOwnedWorker(contractorId, workerId);
  const site = worker.siteId ? await Site.findById(worker.siteId).lean() : null;
  return { worker: serializeWorker(worker), site };
}

export async function createWorker(ctx, input) {
  const today = todayIST();
  const joinedOn = input.joinedOn ?? today;
  if (joinedOn > today)
    throw httpError(400, 'Joining date cannot be in the future', [
      { path: 'joinedOn', message: 'Cannot be in the future' },
    ]);
  await assertOwnedSite(ctx.contractorId, input.siteId);

  const worker = await Worker.create({
    ...input,
    siteId: input.siteId ?? null,
    joinedOn,
    contractorId: ctx.contractorId,
    rateHistory: [{ rate: input.dailyRate, effectiveFrom: joinedOn, setBy: ctx.actor.id }],
  });
  await recordAudit({
    ...ctx,
    action: 'worker.create',
    entity: 'Worker',
    entityId: worker._id,
    after: pick(worker, AUDIT_FIELDS),
  });
  return serializeWorker(worker);
}

export async function updateWorker(ctx, workerId, changes) {
  const worker = await findOwnedWorker(ctx.contractorId, workerId);
  await assertOwnedSite(ctx.contractorId, changes.siteId);
  const before = pick(worker, AUDIT_FIELDS);
  const { joinedOn, ...profile } = changes;
  if (joinedOn && joinedOn !== worker.joinedOn) await moveJoinDate(worker, joinedOn);
  worker.set(profile);
  await worker.save();
  await recordAudit({
    ...ctx,
    action: 'worker.update',
    entity: 'Worker',
    entityId: worker._id,
    before,
    after: pick(worker, AUDIT_FIELDS),
  });
  return serializeWorker(worker);
}

// Corrects a mistyped joining date. The first rate entry moves with it, so it must stay
// before any later rate change and after no existing attendance or payment.
async function moveJoinDate(worker, joinedOn) {
  const fail = (message) => httpError(400, message, [{ path: 'joinedOn', message }]);
  if (joinedOn > todayIST()) throw fail('Joining date cannot be in the future');
  const [first, ...later] = [...worker.rateHistory].sort((x, y) =>
    x.effectiveFrom.localeCompare(y.effectiveFrom)
  );
  if (later.length && joinedOn >= later[0].effectiveFrom)
    throw fail(`Joining date must be before the rate change on ${later[0].effectiveFrom}`);
  const earlier = { workerId: worker._id, day: { $lt: joinedOn } };
  const [attendance, payment] = await Promise.all([
    Attendance.exists(earlier),
    Payment.exists({ ...earlier, voidedAt: null }),
  ]);
  if (attendance || payment) throw fail('This worker has attendance or payments before that date');
  first.effectiveFrom = joinedOn;
  worker.joinedOn = joinedOn;
}

// Adds a rate starting on `effectiveFrom` and re-prices days already marked from then on.
export async function changeRate(ctx, workerId, { dailyRate, effectiveFrom }) {
  const today = todayIST();
  const from = effectiveFrom ?? today;
  let result;

  await mongoose.connection.transaction(async (session) => {
    const worker = await findOwnedWorker(ctx.contractorId, workerId, { session });
    const latest = latestRateEntry(worker);
    if (from < latest.effectiveFrom || from > today) {
      throw httpError(
        400,
        `New rate must start on or after ${latest.effectiveFrom} and not in the future`,
        [{ path: 'effectiveFrom', message: 'Pick a later date' }]
      );
    }
    const before = { dailyRate: worker.dailyRate };
    if (from === latest.effectiveFrom) {
      // Same start day: this corrects the latest rate (e.g. a typo) instead of adding one.
      latest.set({ rate: dailyRate, setAt: new Date(), setBy: ctx.actor.id });
    } else {
      worker.rateHistory.push({ rate: dailyRate, effectiveFrom: from, setBy: ctx.actor.id });
    }
    worker.dailyRate = dailyRate;
    worker.ledgerVersion += 1;
    await worker.save({ session });

    const half = Math.floor(dailyRate / 2);
    const repriced = await Attendance.updateMany(
      { workerId: worker._id, day: { $gte: from } },
      [
        {
          $set: {
            rateSnapshot: dailyRate,
            earned: {
              $switch: {
                branches: [
                  { case: { $eq: ['$status', 'present'] }, then: dailyRate },
                  { case: { $eq: ['$status', 'half-day'] }, then: half },
                ],
                default: 0,
              },
            },
          },
        },
      ],
      { session }
    );
    const repricedDays = repriced.matchedCount;
    await recordAudit({
      ...ctx,
      session,
      action: 'worker.rate',
      entity: 'Worker',
      entityId: worker._id,
      before,
      after: { dailyRate, effectiveFrom: from, repricedDays },
    });
    result = { worker: serializeWorker(worker), repricedDays };
  });
  return result;
}

export async function setActive(ctx, workerId, isActive) {
  const worker = await findOwnedWorker(ctx.contractorId, workerId);
  const before = { isActive: worker.isActive };
  worker.isActive = isActive;
  worker.deactivatedOn = isActive ? null : todayIST();
  await worker.save();
  await recordAudit({
    ...ctx,
    action: isActive ? 'worker.reactivate' : 'worker.deactivate',
    entity: 'Worker',
    entityId: worker._id,
    before,
    after: { isActive },
  });
  return serializeWorker(worker);
}

const SUMMARY_ATTENDANCE_DAYS = 60;
const SUMMARY_PAYMENTS = 20;

// Everything the worker profile page needs in one call.
export async function getWorkerSummary(contractorId, workerId) {
  const { worker, site } = await getWorker(contractorId, workerId);
  const since = addDays(todayIST(), -(SUMMARY_ATTENDANCE_DAYS - 1));
  const [balance, recentAttendance, recentPayments] = await Promise.all([
    getBalance(contractorId, worker._id),
    Attendance.find({ contractorId, workerId: worker._id, day: { $gte: since } })
      .sort({ day: -1 })
      .lean(),
    Payment.find({ contractorId, workerId: worker._id })
      .sort({ day: -1, createdAt: -1 })
      .limit(SUMMARY_PAYMENTS)
      .lean(),
  ]);
  return { worker, site, balance, recentAttendance, recentPayments };
}

const sumOf = async (model, match, field) => {
  const [row] = await model.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: `$${field}` } } },
  ]);
  return row?.total ?? 0;
};

// A wage slip: what the worker was owed before the period, what they earned and were paid in it
// (voided payments left out), and what they are owed at its end.
export async function getWageSlip(contractorId, workerId, { from, to }) {
  const { worker, site } = await getWorker(contractorId, workerId);
  const scope = {
    contractorId: new mongoose.Types.ObjectId(String(contractorId)),
    workerId: worker._id,
  };
  const before = { ...scope, day: { $lt: from } };
  const during = { ...scope, day: { $gte: from, $lte: to } };
  const [contractor, attendance, payments, earnedBefore, paidBefore] = await Promise.all([
    User.findById(contractorId).select('name phone').lean(),
    Attendance.find(during).sort({ day: 1 }).lean(),
    Payment.find({ ...during, voidedAt: null })
      .sort({ day: 1, createdAt: 1 })
      .lean(),
    sumOf(Attendance, before, 'earned'),
    sumOf(Payment, { ...before, voidedAt: null }, 'amount'),
  ]);
  const count = (status) => attendance.filter((a) => a.status === status).length;
  const paidOf = (type) =>
    payments.filter((p) => p.type === type).reduce((t, p) => t + p.amount, 0);
  const totals = {
    present: count('present'),
    halfDay: count('half-day'),
    absent: count('absent'),
    earned: attendance.reduce((t, a) => t + a.earned, 0),
    wagesPaid: paidOf('wage'),
    advancesPaid: paidOf('advance'),
  };
  const openingBalance = earnedBefore - paidBefore;
  return {
    worker,
    site,
    contractor: { name: contractor?.name, phone: contractor?.phone ?? null },
    from,
    to,
    days: attendance.map((a) => ({
      day: a.day,
      status: a.status,
      rate: a.rateSnapshot,
      earned: a.earned,
    })),
    payments: payments.map((p) => ({
      _id: p._id,
      day: p.day,
      amount: p.amount,
      type: p.type,
      method: p.method,
      reference: p.reference ?? null,
    })),
    totals,
    openingBalance,
    closingBalance: openingBalance + totals.earned - totals.wagesPaid - totals.advancesPaid,
  };
}
