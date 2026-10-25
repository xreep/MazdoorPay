import mongoose from 'mongoose';
import { LIMITS, diffDays, earnedFor, monthDays, todayIST } from '@mazdoorpay/shared';
import { Attendance } from '../models/Attendance.js';
import { Worker } from '../models/Worker.js';
import { httpError } from '../utils/httpError.js';
import { pageResult, skipFor } from '../utils/pagination.js';
import { recordAuditMany } from './audit.service.js';
import { findOwnedSite } from './site.service.js';
import { rateOn } from './rate.js';

const { ObjectId } = mongoose.Types;

function checkDay(day, reason) {
  const today = todayIST();
  if (day > today)
    throw httpError(400, 'Attendance cannot be marked for a future day', [
      { path: 'day', message: 'Future day' },
    ]);
  if (diffDays(day, today) > LIMITS.BACKDATE_REASON_DAYS && !reason) {
    throw httpError(
      400,
      `Please give a reason for changing attendance older than ${LIMITS.BACKDATE_REASON_DAYS} days`,
      [{ path: 'reason', message: 'Reason required' }]
    );
  }
}

const recordError = (worker, day) => {
  if (!worker) return 'Worker not found';
  if (!worker.isActive) return 'Worker is inactive';
  if (day < worker.joinedOn) return 'Worker had not joined on this day';
  if (!worker.siteId) return 'Assign this worker to a site first';
  return null;
};

// Saves a day's attendance for many workers at once. Invalid records are reported, valid ones still save.
export async function markAttendance({
  actor,
  contractorId,
  day,
  records,
  reason,
  method = 'manual',
  ip,
}) {
  checkDay(day, reason);
  const ids = records.map((r) => r.workerId);
  const result = { saved: 0, unchanged: 0, errors: [] };

  await mongoose.connection.transaction(async (session) => {
    result.saved = 0;
    result.unchanged = 0;
    result.errors = [];
    const [workers, existing] = await Promise.all([
      Worker.find({ _id: { $in: ids }, contractorId })
        .session(session)
        .lean(),
      Attendance.find({ workerId: { $in: ids }, day })
        .session(session)
        .lean(),
    ]);
    const workerById = new Map(workers.map((w) => [String(w._id), w]));
    const existingByWorker = new Map(existing.map((r) => [String(r.workerId), r]));

    const ops = [];
    const audits = [];
    const changedWorkers = [];
    for (const { workerId, status } of records) {
      const worker = workerById.get(workerId);
      const error = recordError(worker, day);
      if (error) {
        result.errors.push({ workerId, error });
        continue;
      }
      const prior = existingByWorker.get(workerId);
      if (prior?.status === status) {
        result.unchanged += 1;
        continue;
      }
      const rateSnapshot = prior?.rateSnapshot ?? rateOn(worker, day);
      const earned = earnedFor(status, rateSnapshot);
      const recordId = prior?._id ?? new ObjectId();
      ops.push({
        updateOne: {
          filter: { workerId: worker._id, day },
          update: {
            $set: { status, rateSnapshot, earned, method, markedBy: actor.id },
            $setOnInsert: {
              _id: recordId,
              contractorId: worker.contractorId,
              siteId: worker.siteId,
            },
          },
          upsert: true,
        },
      });
      changedWorkers.push(worker._id);
      audits.push({
        actor,
        contractorId,
        ip,
        action: prior ? 'attendance.update' : 'attendance.create',
        entity: 'Attendance',
        entityId: recordId,
        before: prior ? { status: prior.status, earned: prior.earned } : undefined,
        after: { workerId: worker._id, day, status, earned, method, ...(reason ? { reason } : {}) },
      });
    }

    if (ops.length) {
      await Attendance.bulkWrite(ops, { session, ordered: true });
      // Earnings changed, so any concurrent payment for these workers must re-check dues.
      await Worker.updateMany(
        { _id: { $in: changedWorkers } },
        { $inc: { ledgerVersion: 1 } },
        { session }
      );
      await recordAuditMany(audits, { session });
    }
    result.saved = ops.length;
  });
  return result;
}

export async function getSheet(contractorId, { siteId, day }) {
  const site = await findOwnedSite(contractorId, siteId);
  const records = await Attendance.find({ contractorId, siteId: site._id, day }).lean();
  const recordByWorker = new Map(records.map((r) => [String(r.workerId), r]));
  const workers = await Worker.find({
    contractorId,
    $or: [
      { siteId: site._id, isActive: true, joinedOn: { $lte: day } },
      { _id: { $in: records.map((r) => r.workerId) } },
    ],
  })
    .sort({ name: 1, _id: 1 })
    .lean();

  const rows = workers.map((w) => {
    const record = recordByWorker.get(String(w._id));
    return {
      workerId: String(w._id),
      name: w.name,
      role: w.role,
      rate: record?.rateSnapshot ?? rateOn(w, day),
      status: record?.status ?? null,
      method: record?.method ?? null,
      isActive: w.isActive,
    };
  });
  const count = (status) => rows.filter((r) => r.status === status).length;
  return {
    day,
    site: site.toObject(),
    workers: rows,
    summary: {
      total: rows.length,
      marked: rows.filter((r) => r.status).length,
      present: count('present'),
      halfDay: count('half-day'),
      absent: count('absent'),
    },
  };
}

export async function listAttendance(contractorId, { siteId, workerId, from, to, page, limit }) {
  const filter = { contractorId };
  if (siteId) filter.siteId = siteId;
  if (workerId) filter.workerId = workerId;
  if (from || to) filter.day = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  const [items, total] = await Promise.all([
    Attendance.find(filter)
      .sort({ day: -1, _id: -1 })
      .skip(skipFor({ page, limit }))
      .limit(limit)
      .populate({ path: 'workerId', select: 'name role' })
      .lean(),
    Attendance.countDocuments(filter),
  ]);
  const data = items.map(({ workerId: w, ...rest }) => ({
    ...rest,
    workerId: w?._id ?? null,
    worker: w ? { name: w.name, role: w.role } : null,
  }));
  return pageResult(data, total, { page, limit });
}

export async function getCalendar(contractorId, { siteId, month }) {
  const match = {
    contractorId: new ObjectId(contractorId),
    day: { $gte: `${month}-01`, $lte: `${month}-31` },
  };
  if (siteId) {
    await findOwnedSite(contractorId, siteId);
    match.siteId = new ObjectId(siteId);
  }
  const grouped = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$day',
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        halfDay: { $sum: { $cond: [{ $eq: ['$status', 'half-day'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        marked: { $sum: 1 },
      },
    },
  ]);
  const byDay = new Map(grouped.map((g) => [g._id, g]));
  return {
    month,
    days: monthDays(month).map((day) => {
      const g = byDay.get(day);
      return {
        day,
        present: g?.present ?? 0,
        halfDay: g?.halfDay ?? 0,
        absent: g?.absent ?? 0,
        marked: g?.marked ?? 0,
      };
    }),
  };
}
