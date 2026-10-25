import { Attendance } from '../models/Attendance.js';
import { Worker } from '../models/Worker.js';
import { Payment } from '../models/Payment.js';
import { Site } from '../models/Site.js';

const startOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};
const endOfDay = (d) => {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
};

export const wageSummaryWorker = async (req, res) => {
  const { workerId, start, end } = req.query;
  if (!workerId) throw Object.assign(new Error('workerId is required'), { statusCode: 400 });

  const worker = await Worker.findOne({
    _id: workerId,
    contractorId: req.user.userId,
  });
  if (!worker) throw Object.assign(new Error('Worker not found'), { statusCode: 404 });

  const match = { workerId: worker._id, contractorId: req.user.userId };
  if (start || end) {
    match.date = {};
    if (start) match.date.$gte = startOfDay(start);
    if (end) match.date.$lte = endOfDay(end);
  }

  const records = await Attendance.find(match);
  let daysPresent = 0;
  let halfDays = 0;
  let absentDays = 0;
  for (const r of records) {
    if (r.status === 'present') daysPresent += 1;
    else if (r.status === 'half-day') halfDays += 1;
    else absentDays += 1;
  }
  const totalEarnings =
    daysPresent * worker.dailyWageRate + halfDays * worker.dailyWageRate * 0.5;

  const payments = await Payment.find({
    workerId: worker._id,
    contractorId: req.user.userId,
    ...(start || end ? { date: match.date } : {}),
  });
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  res.json({
    worker: { id: worker._id, name: worker.name, role: worker.role, dailyWageRate: worker.dailyWageRate },
    period: { start, end },
    daysPresent,
    halfDays,
    absentDays,
    totalEarnings,
    totalPaid,
    pending: totalEarnings - totalPaid,
    records,
  });
};

export const wageSummarySite = async (req, res) => {
  const { siteId, start, end } = req.query;
  if (!siteId) throw Object.assign(new Error('siteId is required'), { statusCode: 400 });

  const site = await Site.findOne({ _id: siteId, contractorId: req.user.userId });
  if (!site) throw Object.assign(new Error('Site not found'), { statusCode: 404 });

  const match = { siteId: site._id, contractorId: req.user.userId };
  if (start || end) {
    match.date = {};
    if (start) match.date.$gte = startOfDay(start);
    if (end) match.date.$lte = endOfDay(end);
  }

  const workers = await Worker.find({ siteId: site._id, contractorId: req.user.userId });
  const workerIds = workers.map((w) => w._id);
  const records = await Attendance.find({ ...match, workerId: { $in: workerIds } });

  const byWorker = {};
  for (const w of workers) {
    byWorker[w._id.toString()] = {
      workerName: w.name,
      role: w.role,
      dailyWageRate: w.dailyWageRate,
      daysPresent: 0,
      halfDays: 0,
      absentDays: 0,
      totalEarnings: 0,
    };
  }
  for (const r of records) {
    const entry = byWorker[r.workerId.toString()];
    if (!entry) continue;
    if (r.status === 'present') {
      entry.daysPresent += 1;
      entry.totalEarnings += entry.dailyWageRate;
    } else if (r.status === 'half-day') {
      entry.halfDays += 1;
      entry.totalEarnings += entry.dailyWageRate * 0.5;
    } else {
      entry.absentDays += 1;
    }
  }

  const workersList = Object.values(byWorker);
  const totals = workersList.reduce(
    (acc, w) => ({
      daysPresent: acc.daysPresent + w.daysPresent,
      halfDays: acc.halfDays + w.halfDays,
      absentDays: acc.absentDays + w.absentDays,
      totalEarnings: acc.totalEarnings + w.totalEarnings,
    }),
    { daysPresent: 0, halfDays: 0, absentDays: 0, totalEarnings: 0 }
  );

  res.json({
    site: { id: site._id, name: site.name },
    period: { start, end },
    workers: workersList,
    totals,
  });
};

export const wageSummaryDashboard = async (req, res) => {
  const workers = await Worker.find({ contractorId: req.user.userId, isActive: true });
  const workerIds = workers.map((w) => w._id);
  const records = await Attendance.find({ contractorId: req.user.userId, workerId: { $in: workerIds } });
  const payments = await Payment.find({ contractorId: req.user.userId });

  let totalEarnings = 0;
  for (const r of records) {
    const w = workers.find((x) => x._id.toString() === r.workerId.toString());
    if (!w) continue;
    if (r.status === 'present') totalEarnings += w.dailyWageRate;
    else if (r.status === 'half-day') totalEarnings += w.dailyWageRate * 0.5;
  }
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  res.json({
    totalWorkers: workers.length,
    totalAttendanceRecords: records.length,
    totalEarnings,
    totalPaid,
    pending: totalEarnings - totalPaid,
  });
};
