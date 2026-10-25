import mongoose from 'mongoose';
import { formatINR, monthDays } from '@mazdoorpay/shared';
import { Attendance } from '../models/Attendance.js';
import { Payment } from '../models/Payment.js';
import { Site } from '../models/Site.js';
import { Worker } from '../models/Worker.js';
import { findOwnedSite } from './site.service.js';
import { getWageSummary } from './wage.service.js';

const { ObjectId } = mongoose.Types;
const MARK = { present: 'P', 'half-day': 'H', absent: 'A' };

const siteNames = async (contractorId) =>
  new Map(
    (await Site.find({ contractorId }).select('name').lean()).map((s) => [String(s._id), s.name])
  );

const rangeMatch = (contractorId, { from, to, siteId }) => {
  const match = { contractorId: new ObjectId(contractorId), day: { $gte: from, $lte: to } };
  if (siteId) match.siteId = new ObjectId(siteId);
  return match;
};

export async function attendanceReport(contractorId, { from, to, siteId }) {
  if (siteId) await findOwnedSite(contractorId, siteId);
  const [records, sites] = await Promise.all([
    Attendance.find(rangeMatch(contractorId, { from, to, siteId }))
      .populate({ path: 'workerId', select: 'name role' })
      .lean(),
    siteNames(contractorId),
  ]);
  const rows = records
    .map((r) => ({
      day: r.day,
      worker: r.workerId?.name ?? '',
      role: r.workerId?.role ?? '',
      site: sites.get(String(r.siteId)) ?? '',
      status: r.status,
      rate: r.rateSnapshot,
      earned: r.earned,
    }))
    .sort((x, y) => x.day.localeCompare(y.day) || x.worker.localeCompare(y.worker));
  return { from, to, rows };
}

export async function musterRoll(contractorId, { month, siteId }) {
  const site = await findOwnedSite(contractorId, siteId);
  const days = monthDays(month);
  const records = await Attendance.find({
    contractorId,
    siteId: site._id,
    day: { $gte: days[0], $lte: days.at(-1) },
  }).lean();
  const workers = await Worker.find({
    contractorId,
    $or: [
      { siteId: site._id, isActive: true, joinedOn: { $lte: days.at(-1) } },
      { _id: { $in: records.map((r) => r.workerId) } },
    ],
  })
    .select('name role')
    .sort({ name: 1 })
    .lean();

  const rows = workers.map((w) => ({
    workerId: String(w._id),
    name: w.name,
    role: w.role,
    marks: {},
    present: 0,
    halfDay: 0,
    absent: 0,
    earned: 0,
  }));
  const byId = new Map(rows.map((r) => [r.workerId, r]));
  for (const r of records) {
    const row = byId.get(String(r.workerId));
    row.marks[r.day] = MARK[r.status];
    row[{ present: 'present', 'half-day': 'halfDay', absent: 'absent' }[r.status]] += 1;
    row.earned += r.earned;
  }
  return { month, site: site.toObject(), days, rows };
}

export async function wageRegister(contractorId, { from, to, siteId }) {
  const summary = await getWageSummary(contractorId, { from, to, groupBy: 'week', siteId });
  const match = rangeMatch(contractorId, { from, to, siteId });
  const [rates, paid, sites] = await Promise.all([
    Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: { workerId: '$workerId', rate: '$rateSnapshot' },
          firstDay: { $min: '$day' },
        },
      },
      { $sort: { firstDay: 1 } },
    ]),
    Payment.aggregate([
      { $match: { ...match, voidedAt: null } },
      { $group: { _id: { workerId: '$workerId', type: '$type' }, total: { $sum: '$amount' } } },
    ]),
    siteNames(contractorId),
  ]);
  const ratesBy = new Map();
  for (const r of rates) {
    const id = String(r._id.workerId);
    ratesBy.set(id, [...(ratesBy.get(id) ?? []), formatINR(r._id.rate)]);
  }
  const paidBy = new Map(paid.map((p) => [`${p._id.workerId}:${p._id.type}`, p.total]));

  const rows = summary.workers.map((w) => ({
    workerId: w.workerId,
    name: w.name,
    role: w.role,
    site: w.siteId ? (sites.get(w.siteId) ?? '') : '',
    present: w.present,
    halfDay: w.halfDay,
    absent: w.absent,
    rates: (ratesBy.get(w.workerId) ?? []).join(' / '),
    gross: w.earned,
    advancesPaid: paidBy.get(`${w.workerId}:advance`) ?? 0,
    wagesPaid: paidBy.get(`${w.workerId}:wage`) ?? 0,
    balance: w.balance,
  }));
  return { from, to, rows };
}

export async function paymentsReport(contractorId, { from, to, siteId, includeVoided }) {
  if (siteId) await findOwnedSite(contractorId, siteId);
  const filter = rangeMatch(contractorId, { from, to, siteId });
  if (!includeVoided) filter.voidedAt = null;
  const payments = await Payment.find(filter)
    .sort({ day: 1, createdAt: 1 })
    .populate({ path: 'workerId', select: 'name' })
    .lean();
  const rows = payments.map((p) => ({
    paymentId: String(p._id),
    day: p.day,
    worker: p.workerId?.name ?? '',
    type: p.type,
    method: p.method,
    reference: p.reference ?? '',
    amount: p.amount,
    status: p.voidedAt ? 'Void' : 'Paid',
    notes: p.voidedAt ? `Void: ${p.voidReason}` : (p.notes ?? ''),
  }));
  return { from, to, rows };
}
