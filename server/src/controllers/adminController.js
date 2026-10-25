import { User } from '../models/User.js';
import { Worker } from '../models/Worker.js';
import { Site } from '../models/Site.js';
import { Attendance } from '../models/Attendance.js';
import { Payment } from '../models/Payment.js';

export const adminDashboard = async (req, res) => {
  const [totalUsers, totalContractors, totalWorkers, totalSites, totalAttendance, totalPayments] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'contractor' }),
      Worker.countDocuments(),
      Site.countDocuments(),
      Attendance.countDocuments(),
      Payment.countDocuments(),
    ]);
  const totalPaid = await Payment.aggregate([{ $group: { _id: null, sum: { $sum: '$amount' } } }]);
  const activeWorkers = await Worker.countDocuments({ isActive: true });
  const activeSites = await Site.countDocuments({ isActive: true });

  res.json({
    totals: {
      totalUsers,
      totalContractors,
      totalWorkers,
      activeWorkers,
      totalSites,
      activeSites,
      totalAttendanceRecords: totalAttendance,
      totalPayments,
      totalPaid: totalPaid[0] ? totalPaid[0].sum : 0,
    },
  });
};

export const listAllUsers = async (req, res) => {
  const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
  res.json({ users });
};

export const dataAccuracy = async (req, res) => {
  const anomalies = [];

  // Attendance for deactivated workers
  const inactiveWorkerIds = await Worker.find({ isActive: false }).distinct('_id');
  if (inactiveWorkerIds.length > 0) {
    const badAttendance = await Attendance.find({ workerId: { $in: inactiveWorkerIds } }).limit(50);
    for (const a of badAttendance) {
      anomalies.push({
        type: 'attendance_for_deactivated_worker',
        workerId: a.workerId,
        date: a.date,
        status: a.status,
      });
    }
  }

  // Attendance for workers of other contractors (site mismatch) - site-level check
  const allAttendance = await Attendance.find().limit(2000).populate('workerId', 'contractorId');
  for (const a of allAttendance) {
    const worker = a.workerId;
    if (worker && String(worker.contractorId) !== String(a.contractorId)) {
      anomalies.push({
        type: 'attendance_contractor_mismatch',
        attendanceId: a._id,
        workerId: a.workerId,
      });
    }
  }

  res.json({ anomalies, anomalyCount: anomalies.length });
};
