import mongoose from 'mongoose';
import { addDays, eachDay, todayIST, weekStart } from '@mazdoorpay/shared';
import { Attendance } from '../models/Attendance.js';
import { Payment } from '../models/Payment.js';
import { Site } from '../models/Site.js';
import { Worker } from '../models/Worker.js';
import { getDues } from './payment.service.js';

const { ObjectId } = mongoose.Types;
const TREND_DAYS = 30;

const statusCounts = {
  present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
  halfDay: { $sum: { $cond: [{ $eq: ['$status', 'half-day'] }, 1, 0] } },
  absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
};

export async function getDashboard(contractorId) {
  const today = todayIST();
  const trendFrom = addDays(today, -(TREND_DAYS - 1));
  const owner = new ObjectId(contractorId);

  const [sites, workersPerSite, todayPerSite, trendRows, paidWeek, dues, activeWorkers] =
    await Promise.all([
      Site.find({ contractorId, isActive: true }).select('name').sort({ name: 1 }).lean(),
      Worker.aggregate([
        { $match: { contractorId: owner, isActive: true } },
        { $group: { _id: '$siteId', n: { $sum: 1 } } },
      ]),
      Attendance.aggregate([
        { $match: { contractorId: owner, day: today } },
        { $group: { _id: '$siteId', marked: { $sum: 1 }, ...statusCounts } },
      ]),
      Attendance.aggregate([
        { $match: { contractorId: owner, day: { $gte: trendFrom, $lte: today } } },
        { $group: { _id: '$day', earned: { $sum: '$earned' }, ...statusCounts } },
      ]),
      Payment.aggregate([
        {
          $match: {
            contractorId: owner,
            voidedAt: null,
            day: { $gte: weekStart(today), $lte: today },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      getDues(contractorId),
      Worker.countDocuments({ contractorId, isActive: true }),
    ]);

  const workerCount = new Map(workersPerSite.map((r) => [String(r._id), r.n]));
  const todayCount = new Map(todayPerSite.map((r) => [String(r._id), r]));
  const trendByDay = new Map(trendRows.map((r) => [r._id, r]));

  return {
    today,
    sites: sites.map((s) => {
      const t = todayCount.get(String(s._id));
      return {
        siteId: String(s._id),
        name: s.name,
        activeWorkers: workerCount.get(String(s._id)) ?? 0,
        marked: t?.marked ?? 0,
        present: t?.present ?? 0,
        halfDay: t?.halfDay ?? 0,
        absent: t?.absent ?? 0,
      };
    }),
    money: {
      pendingDues: dues.totals.pending,
      advanceOutstanding: dues.totals.advance,
      workersWithDues: dues.totals.workersWithDues,
      paidThisWeek: paidWeek[0]?.total ?? 0,
    },
    trend: eachDay(trendFrom, today).map((day) => {
      const r = trendByDay.get(day);
      return {
        day,
        present: r?.present ?? 0,
        halfDay: r?.halfDay ?? 0,
        absent: r?.absent ?? 0,
        earned: r?.earned ?? 0,
      };
    }),
    counts: { activeSites: sites.length, activeWorkers },
  };
}
