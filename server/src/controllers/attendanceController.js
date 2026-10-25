import { Attendance } from '../models/Attendance.js';
import { Worker } from '../models/Worker.js';
import { Site } from '../models/Site.js';

export const markAttendance = async (req, res) => {
  const { date, records } = req.body || {};
  if (!date) throw Object.assign(new Error('Date is required'), { statusCode: 400 });
  if (!Array.isArray(records) || records.length === 0) {
    throw Object.assign(new Error('Attendance records are required'), { statusCode: 400 });
  }

  const attendanceDate = new Date(date);
  attendanceDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (attendanceDate > today) {
    throw Object.assign(new Error('Attendance date cannot be in the future'), { statusCode: 400 });
  }

  const results = [];
  const errors = [];
  for (const record of records) {
    const { workerId, status } = record;
    if (!workerId || !status) {
      errors.push({ workerId, error: 'workerId and status required' });
      continue;
    }
    const worker = await Worker.findOne({
      _id: workerId,
      contractorId: req.user.userId,
    });
    if (!worker) {
      errors.push({ workerId, error: 'Worker not found' });
      continue;
    }
    try {
      const attendance = await Attendance.findOneAndUpdate(
        { workerId, date: attendanceDate, contractorId: req.user.userId },
        {
          $set: {
            siteId: worker.siteId,
            status,
            markedBy: req.user.userId,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
      results.push(attendance);
    } catch (err) {
      if (err.code === 11000) {
        errors.push({ workerId, error: 'Attendance already marked for this date' });
      } else {
        errors.push({ workerId, error: err.message });
      }
    }
  }

  res.json({ marked: results.length, results, errors });
};

export const getAttendance = async (req, res) => {
  const { siteId, workerId, start, end } = req.query;
  const filter = { contractorId: req.user.userId };
  if (siteId) filter.siteId = siteId;
  if (workerId) filter.workerId = workerId;
  if (start || end) {
    filter.date = {};
    if (start) filter.date.$gte = new Date(start);
    if (end) filter.date.$lte = new Date(end);
  }
  const attendance = await Attendance.find(filter).sort({ date: -1, createdAt: -1 });
  res.json({ attendance });
};

export const getAttendanceGrid = async (req, res) => {
  const { siteId, date } = req.query;
  const filter = { contractorId: req.user.userId };
  if (siteId) filter.siteId = siteId;
  const workers = await Worker.find(filter).sort({ name: 1 });

  const attendanceDate = date ? new Date(date) : new Date();
  attendanceDate.setHours(0, 0, 0, 0);

  const existing = await Attendance.find({
    contractorId: req.user.userId,
    ...(siteId ? { siteId } : {}),
    date: attendanceDate,
  });
  const existingMap = {};
  for (const a of existing) existingMap[a.workerId.toString()] = a.status;

  const grid = workers.map((w) => ({
    workerId: w._id,
    workerName: w.name,
    role: w.role,
    dailyWageRate: w.dailyWageRate,
    status: existingMap[w._id.toString()] || '',
    isActive: w.isActive,
  }));

  res.json({ date: attendanceDate, siteId, grid });
};
