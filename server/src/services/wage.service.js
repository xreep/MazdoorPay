import mongoose from 'mongoose';
import { addDays, eachDay, weekEnd, weekStart } from '@mazdoorpay/shared';
import { Attendance } from '../models/Attendance.js';
import { Payment } from '../models/Payment.js';
import { Worker } from '../models/Worker.js';
import { getBalances } from './ledger.service.js';
import { findOwnedSite } from './site.service.js';

const { ObjectId } = mongoose.Types;

const emptyCounts = () => ({ present: 0, halfDay: 0, absent: 0, earned: 0 });

const STATUS_KEY = { present: 'present', 'half-day': 'halfDay', absent: 'absent' };

export function buildBuckets(from, to, groupBy) {
  if (groupBy === 'day') return eachDay(from, to).map((day) => ({ start: day, end: day }));
  const buckets = [];
  for (let ws = weekStart(from); ws <= to; ws = addDays(ws, 7)) {
    buckets.push({ start: ws < from ? from : ws, end: weekEnd(ws) > to ? to : weekEnd(ws) });
  }
  return buckets;
}

const bucketKeyFor = (groupBy, from) => (day) => {
  if (groupBy === 'day') return day;
  const ws = weekStart(day);
  return ws < from ? from : ws;
};

const add = (target, status, earned) => {
  target[STATUS_KEY[status]] += 1;
  target.earned += earned;
};

// Earnings per day or week, read from stored `earned` (never recomputed from today's rate).
export async function getWageSummary(contractorId, { from, to, groupBy, siteId, workerId }) {
  if (siteId) await findOwnedSite(contractorId, siteId);
  const match = { contractorId: new ObjectId(contractorId), day: { $gte: from, $lte: to } };
  if (siteId) match.siteId = new ObjectId(siteId);
  if (workerId) match.workerId = new ObjectId(workerId);

  const [rows, paid] = await Promise.all([
    Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: { workerId: '$workerId', day: '$day', status: '$status' },
          earned: { $sum: '$earned' },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { ...match, voidedAt: null } },
      { $group: { _id: { workerId: '$workerId', type: '$type' }, total: { $sum: '$amount' } } },
    ]),
  ]);

  const buckets = buildBuckets(from, to, groupBy).map((b) => ({ ...b, ...emptyCounts() }));
  const bucketIndex = new Map(buckets.map((b, i) => [b.start, i]));
  const keyOf = bucketKeyFor(groupBy, from);
  // What was paid in the period, split into wages and advances (voided payments left out).
  const paidBy = new Map();
  for (const { _id, total } of paid) {
    const id = String(_id.workerId);
    const entry = paidBy.get(id) ?? { wage: 0, advance: 0 };
    entry[_id.type] += total;
    paidBy.set(id, entry);
  }

  const perWorker = new Map();
  const workerRow = (id) => {
    if (!perWorker.has(id)) {
      perWorker.set(id, {
        ...emptyCounts(),
        buckets: buckets.map((b) => ({ start: b.start, ...emptyCounts() })),
      });
    }
    return perWorker.get(id);
  };
  for (const { _id, earned } of rows) {
    const i = bucketIndex.get(keyOf(_id.day));
    const w = workerRow(String(_id.workerId));
    add(w, _id.status, earned);
    add(w.buckets[i], _id.status, earned);
    add(buckets[i], _id.status, earned);
  }
  for (const id of paidBy.keys()) workerRow(id);
  // The all-time balance is about every worker who has one, not only those active in the period,
  // so a quiet week still shows what is owed.
  const scope = { contractorId };
  if (siteId) scope.siteId = siteId;
  if (workerId) scope._id = workerId;
  const inScope = await Worker.find(scope).select('_id').lean();
  const owed = await getBalances(contractorId, { workerIds: inScope.map((w) => w._id) });
  for (const [id, b] of owed) if (b.balance !== 0) workerRow(id);

  const ids = [...perWorker.keys()];
  const [workers, balances] = await Promise.all([
    Worker.find({ _id: { $in: ids }, contractorId })
      .select('name role siteId')
      .lean(),
    getBalances(contractorId, { workerIds: ids }),
  ]);
  const workerRows = workers
    .map((w) => {
      const id = String(w._id);
      const { buckets: wb, ...counts } = perWorker.get(id);
      return {
        workerId: id,
        name: w.name,
        role: w.role,
        siteId: w.siteId ? String(w.siteId) : null,
        ...counts,
        paidInPeriod: (paidBy.get(id)?.wage ?? 0) + (paidBy.get(id)?.advance ?? 0),
        wagesPaidInPeriod: paidBy.get(id)?.wage ?? 0,
        advancesInPeriod: paidBy.get(id)?.advance ?? 0,
        balance: balances.get(id).balance,
        buckets: wb,
      };
    })
    .sort((x, y) => x.name.localeCompare(y.name));

  const totals = {
    ...emptyCounts(),
    paidInPeriod: 0,
    wagesPaidInPeriod: 0,
    advancesInPeriod: 0,
    balance: 0,
  };
  for (const w of workerRows) {
    for (const k of Object.keys(totals)) totals[k] += w[k];
  }
  return { from, to, groupBy, buckets, workers: workerRows, totals };
}
