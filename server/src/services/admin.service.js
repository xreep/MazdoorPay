import { PATTERNS, addDays, eachDay, todayIST, weekStart } from '@mazdoorpay/shared';
import { User } from '../models/User.js';
import { Site } from '../models/Site.js';
import { Worker } from '../models/Worker.js';
import { Attendance } from '../models/Attendance.js';
import { Payment } from '../models/Payment.js';
import { AuditLog } from '../models/AuditLog.js';
import { httpError } from '../utils/httpError.js';
import { pageResult, skipFor } from '../utils/pagination.js';
import { recordAudit } from './audit.service.js';
import { revokeAllForUser } from './auth.service.js';
import { getDues } from './payment.service.js';
import { getBalances } from './ledger.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;
const MAX_ANOMALIES = 500;
const USER_FIELDS =
  'name email phone role status suspendedReason lastLoginAt preferredLanguage isDemo createdAt';

// Midnight in India at the start of `day`, as a real instant.
const istMidnight = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - IST_OFFSET_MS);
const istDayExpr = (field) => ({
  $dateToString: { format: '%Y-%m-%d', date: field, timezone: 'Asia/Kolkata' },
});
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pct = (part, whole, empty = 100) => (whole ? Math.round((part / whole) * 1000) / 10 : empty);

const activeContractorIds = (days) =>
  AuditLog.distinct('actorId', {
    actorRole: 'contractor',
    at: { $gte: new Date(Date.now() - days * DAY_MS) },
  });

// Demo admins see only the demo accounts; `demoOnly` narrows a user lookup to them.
const demoScope = (demoOnly) => (demoOnly ? { isDemo: true } : {});
const demoContractorIds = () => User.distinct('_id', { isDemo: true, role: 'contractor' });

const paidTotals = async (match = {}) => {
  const [row] = await Payment.aggregate([
    { $match: { ...match, voidedAt: null } },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } },
  ]);
  return { count: row?.count ?? 0, total: row?.total ?? 0 };
};

export async function getOverview() {
  const [
    contractors,
    activeContractors,
    workers,
    activeWorkers,
    sites,
    attendanceRecords,
    paid,
    a7,
    a30,
  ] = await Promise.all([
    User.countDocuments({ role: 'contractor' }),
    User.countDocuments({ role: 'contractor', status: 'active' }),
    Worker.countDocuments(),
    Worker.countDocuments({ isActive: true }),
    Site.countDocuments(),
    Attendance.estimatedDocumentCount(),
    paidTotals(),
    activeContractorIds(7),
    activeContractorIds(30),
  ]);
  return {
    totals: {
      contractors,
      activeContractors,
      suspendedContractors: contractors - activeContractors,
      workers,
      activeWorkers,
      sites,
      attendanceRecords,
      payments: paid.count,
      totalPaid: paid.total,
    },
    engagement: { active7d: a7.length, active30d: a30.length },
  };
}

export async function getGrowth({ weeks }) {
  const currentWeek = weekStart(todayIST());
  const starts = Array.from({ length: weeks }, (_, i) =>
    addDays(currentWeek, -7 * (weeks - 1 - i))
  );
  const first = starts[0];
  const byCreatedDay = (model, match = {}) =>
    model.aggregate([
      { $match: { ...match, createdAt: { $gte: istMidnight(first) } } },
      { $group: { _id: istDayExpr('$createdAt'), n: { $sum: 1 } } },
    ]);
  const byBusinessDay = (model, match = {}) =>
    model.aggregate([
      { $match: { ...match, day: { $gte: first } } },
      { $group: { _id: '$day', n: { $sum: 1 } } },
    ]);

  const [contractors, workers, attendance, payments] = await Promise.all([
    byCreatedDay(User, { role: 'contractor' }),
    byCreatedDay(Worker),
    byBusinessDay(Attendance),
    byBusinessDay(Payment, { voidedAt: null }),
  ]);
  const rows = new Map(
    starts.map((s) => [
      s,
      { weekStart: s, newContractors: 0, newWorkers: 0, attendanceRecords: 0, payments: 0 },
    ])
  );
  const fold = (groups, key) => {
    for (const g of groups) {
      const row = rows.get(weekStart(g._id));
      if (row) row[key] += g.n;
    }
  };
  fold(contractors, 'newContractors');
  fold(workers, 'newWorkers');
  fold(attendance, 'attendanceRecords');
  fold(payments, 'payments');
  return { weeks: [...rows.values()] };
}

export async function listUsers({ q, status, role, page, limit }, { demoOnly } = {}) {
  const filter = demoScope(demoOnly);
  if (status) filter.status = status;
  if (role) filter.role = role;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
  }
  const [users, total] = await Promise.all([
    User.find(filter)
      .select(USER_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skipFor({ page, limit }))
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  const ids = users.map((u) => u._id);
  const [siteCounts, workerCounts] = await Promise.all([
    Site.aggregate([
      { $match: { contractorId: { $in: ids } } },
      { $group: { _id: '$contractorId', n: { $sum: 1 } } },
    ]),
    Worker.aggregate([
      { $match: { contractorId: { $in: ids } } },
      { $group: { _id: '$contractorId', n: { $sum: 1 } } },
    ]),
  ]);
  const count = (rows) => new Map(rows.map((r) => [String(r._id), r.n]));
  const sitesBy = count(siteCounts);
  const workersBy = count(workerCounts);
  const data = users.map((u) => ({
    ...u,
    sites: sitesBy.get(String(u._id)) ?? 0,
    workers: workersBy.get(String(u._id)) ?? 0,
  }));
  return pageResult(data, total, { page, limit });
}

export async function getUser(userId, { demoOnly } = {}) {
  const user = await User.findOne({ _id: userId, ...demoScope(demoOnly) })
    .select(USER_FIELDS)
    .lean();
  if (!user) throw httpError(404, 'User not found');
  const scope = { contractorId: user._id };
  const [sites, workers, activeWorkers, attendanceRecords, paid, dues] = await Promise.all([
    Site.find(scope).sort({ name: 1 }).lean(),
    Worker.countDocuments(scope),
    Worker.countDocuments({ ...scope, isActive: true }),
    Attendance.countDocuments(scope),
    paidTotals(scope),
    getDues(String(user._id)),
  ]);
  return {
    user,
    sites,
    stats: {
      workers,
      activeWorkers,
      attendanceRecords,
      payments: paid.count,
      totalPaid: paid.total,
      pendingDues: dues.totals.pending,
      advanceOutstanding: dues.totals.advance,
    },
  };
}

async function setStatus(ctx, userId, status, reason) {
  const user = await User.findOne({ _id: userId, ...demoScope(ctx.demoOnly) }).select(USER_FIELDS);
  if (!user) throw httpError(404, 'User not found');
  if (user.role === 'admin' || String(user._id) === ctx.actor.id)
    throw httpError(400, 'Admins cannot be suspended here');
  if (user.isDemo)
    throw httpError(400, 'Demo accounts are shared with everyone and cannot be suspended');
  const before = { status: user.status, suspendedReason: user.suspendedReason };
  user.status = status;
  user.suspendedReason = status === 'suspended' ? reason : undefined;
  await user.save();
  if (status === 'suspended') await revokeAllForUser(user._id);
  await recordAudit({
    actor: ctx.actor,
    ip: ctx.ip,
    contractorId: user._id,
    action: status === 'suspended' ? 'admin.suspend' : 'admin.reactivate',
    entity: 'User',
    entityId: user._id,
    before,
    after: { status, suspendedReason: user.suspendedReason },
  });
  return user.toObject();
}

export const suspendUser = (ctx, userId, reason) => setStatus(ctx, userId, 'suspended', reason);
export const reactivateUser = (ctx, userId) => setStatus(ctx, userId, 'active');

export async function listActivity(
  { contractorId, action, from, to, page, limit },
  { demoOnly } = {}
) {
  const filter = {};
  if (demoOnly) {
    const ids = await demoContractorIds();
    filter.contractorId = {
      $in: contractorId ? ids.filter((id) => String(id) === contractorId) : ids,
    };
  } else if (contractorId) filter.contractorId = contractorId;
  if (action) filter.action = action;
  if (from || to)
    filter.at = {
      ...(from && { $gte: istMidnight(from) }),
      ...(to && { $lt: istMidnight(addDays(to, 1)) }),
    };
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ at: -1, _id: -1 })
      .skip(skipFor({ page, limit }))
      .limit(limit)
      .populate({ path: 'actorId', select: 'name email role' })
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  const data = items.map(({ actorId: a, ...rest }) => ({
    ...rest,
    actorId: a?._id ?? null,
    actor: a ? { name: a.name, email: a.email, role: a.role } : null,
  }));
  return pageResult(data, total, { page, limit });
}

const workerLookup = [
  {
    $lookup: {
      from: Worker.collection.name,
      localField: 'workerId',
      foreignField: '_id',
      as: 'worker',
    },
  },
  { $unwind: '$worker' },
];

// Rows that break the platform's own rules; most can only appear through manual database edits.
export async function findAnomalies({ demoOnly } = {}) {
  const [inactive, beforeJoin, overpaid, upi, noSite, duplicates] = await Promise.all([
    Attendance.aggregate([
      ...workerLookup,
      {
        $match: {
          'worker.isActive': false,
          'worker.deactivatedOn': { $ne: null },
          $expr: { $gt: ['$day', '$worker.deactivatedOn'] },
        },
      },
      { $limit: MAX_ANOMALIES },
    ]),
    Attendance.aggregate([
      ...workerLookup,
      { $match: { $expr: { $lt: ['$day', '$worker.joinedOn'] } } },
      { $limit: MAX_ANOMALIES },
    ]),
    Payment.aggregate([
      { $match: { voidedAt: null, type: 'wage' } },
      {
        $group: {
          _id: { contractorId: '$contractorId', workerId: '$workerId' },
          wages: { $sum: '$amount' },
        },
      },
      {
        $lookup: {
          from: Attendance.collection.name,
          localField: '_id.workerId',
          foreignField: 'workerId',
          as: 'att',
          pipeline: [{ $group: { _id: null, earned: { $sum: '$earned' } } }],
        },
      },
      { $addFields: { earned: { $ifNull: [{ $first: '$att.earned' }, 0] } } },
      { $match: { $expr: { $gt: ['$wages', '$earned'] } } },
      { $limit: MAX_ANOMALIES },
    ]),
    Payment.find({
      voidedAt: null,
      method: 'upi',
      $or: [{ reference: null }, { reference: { $not: PATTERNS.UTR } }],
    })
      .limit(MAX_ANOMALIES)
      .lean(),
    Worker.find({ isActive: true, siteId: null }).limit(MAX_ANOMALIES).lean(),
    Worker.aggregate([
      { $match: { phone: { $nin: [null, ''] } } },
      {
        $group: {
          _id: { contractorId: '$contractorId', name: { $toLower: '$name' }, phone: '$phone' },
          ids: { $push: '$_id' },
          n: { $sum: 1 },
        },
      },
      { $match: { n: { $gt: 1 } } },
      { $limit: MAX_ANOMALIES },
    ]),
  ]);

  const id = (v) => (v ? String(v) : undefined);
  const visible = demoOnly ? new Set((await demoContractorIds()).map(String)) : null;
  const anomalies = [
    ...inactive.map((r) => ({
      type: 'attendance_inactive_worker',
      contractorId: id(r.contractorId),
      workerId: id(r.workerId),
      day: r.day,
      detail: `${r.worker.name} marked ${r.status} on ${r.day} after being deactivated on ${r.worker.deactivatedOn}`,
    })),
    ...beforeJoin.map((r) => ({
      type: 'attendance_before_join',
      contractorId: id(r.contractorId),
      workerId: id(r.workerId),
      day: r.day,
      detail: `${r.worker.name} marked on ${r.day} but joined on ${r.worker.joinedOn}`,
    })),
    ...overpaid.map((r) => ({
      type: 'wage_payment_exceeds_earnings',
      contractorId: id(r._id.contractorId),
      workerId: id(r._id.workerId),
      detail: `Wages paid ${r.wages} paise exceed earnings ${r.earned} paise`,
    })),
    ...upi.map((p) => ({
      type: 'upi_without_reference',
      contractorId: id(p.contractorId),
      workerId: id(p.workerId),
      paymentId: id(p._id),
      day: p.day,
      detail: 'UPI payment without a 12-digit UTR',
    })),
    ...noSite.map((w) => ({
      type: 'worker_without_site',
      contractorId: id(w.contractorId),
      workerId: id(w._id),
      detail: `${w.name} is active but not assigned to a site`,
    })),
    ...duplicates.map((d) => ({
      type: 'possible_duplicate_worker',
      contractorId: id(d._id.contractorId),
      workerId: id(d.ids[0]),
      detail: `${d.n} workers named "${d._id.name}" with phone ${d._id.phone}`,
    })),
  ]
    .filter((a) => !visible || visible.has(a.contractorId))
    .slice(0, MAX_ANOMALIES);

  const counts = {};
  for (const a of anomalies) counts[a.type] = (counts[a.type] ?? 0) + 1;
  return { counts, anomalies };
}

export async function getKpis() {
  const [
    contractors,
    activeContractors,
    workersManaged,
    attendanceRecords,
    a7,
    a30,
    payments,
    anomalyReport,
  ] = await Promise.all([
    User.countDocuments({ role: 'contractor' }),
    User.countDocuments({ role: 'contractor', status: 'active' }),
    Worker.countDocuments(),
    Attendance.estimatedDocumentCount(),
    activeContractorIds(7),
    activeContractorIds(30),
    Payment.find({ voidedAt: null }).select('workerId type method reference').lean(),
    findAnomalies(),
  ]);
  const overpaidWorkers = new Set(
    anomalyReport.anomalies
      .filter((a) => a.type === 'wage_payment_exceeds_earnings')
      .map((a) => a.workerId)
  );
  const flaggedPayments = new Set(
    anomalyReport.anomalies.filter((a) => a.paymentId).map((a) => a.paymentId)
  );
  const accurate = payments.filter(
    (p) =>
      !flaggedPayments.has(String(p._id)) &&
      !(p.type === 'wage' && overpaidWorkers.has(String(p.workerId)))
  );
  const digital = payments.filter((p) => p.method !== 'cash');
  return {
    contractors,
    activeContractors7d: a7.length,
    activeContractors30d: a30.length,
    engagementRate7d: Math.min(pct(a7.length, activeContractors, 0), 100),
    workersManaged,
    attendanceRecords,
    paymentAccuracyPct: pct(accurate.length, payments.length),
    digitalReferencePct: pct(digital.filter((p) => p.reference).length, digital.length),
  };
}

// Platform activity per IST day: audit entries written and distinct contractors acting.
export async function getDailyActivity({ days }) {
  const today = todayIST();
  const from = addDays(today, -(days - 1));
  const rows = await AuditLog.aggregate([
    { $match: { at: { $gte: istMidnight(from) } } },
    {
      $group: {
        _id: istDayExpr('$at'),
        actions: { $sum: 1 },
        contractors: {
          $addToSet: { $cond: [{ $eq: ['$actorRole', 'contractor'] }, '$actorId', '$$REMOVE'] },
        },
      },
    },
  ]);
  const byDay = new Map(rows.map((r) => [r._id, r]));
  return {
    days: eachDay(from, today).map((day) => ({
      day,
      actions: byDay.get(day)?.actions ?? 0,
      activeContractors: byDay.get(day)?.contractors.length ?? 0,
    })),
  };
}

const maskPhone = (phone) => (phone ? `${phone.slice(0, 2)}******${phone.slice(-2)}` : null);
const maskUpi = (upi) => {
  if (!upi) return null;
  const [name, bank] = upi.split('@');
  return `${name.slice(0, 2)}****@${bank}`;
};

// Read-only view of a contractor's workers for admins; contact details are masked.
export async function listContractorWorkers(userId, { status, page, limit }, { demoOnly } = {}) {
  if (!(await User.exists({ _id: userId, ...demoScope(demoOnly) })))
    throw httpError(404, 'User not found');
  const filter = { contractorId: userId };
  if (status !== 'all') filter.isActive = status === 'active';
  const [workers, total] = await Promise.all([
    Worker.find(filter)
      .select('name role dailyRate siteId phone upiId joinedOn isActive')
      .sort({ name: 1, _id: 1 })
      .skip(skipFor({ page, limit }))
      .limit(limit)
      .lean(),
    Worker.countDocuments(filter),
  ]);
  const balances = await getBalances(userId, { workerIds: workers.map((w) => w._id) });
  const data = workers.map((w) => ({
    ...w,
    phone: maskPhone(w.phone),
    upiId: maskUpi(w.upiId),
    balance: balances.get(String(w._id)).balance,
  }));
  return pageResult(data, total, { page, limit });
}
