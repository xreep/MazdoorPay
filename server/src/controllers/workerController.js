import { Worker } from '../models/Worker.js';
import { Site } from '../models/Site.js';
import { Attendance } from '../models/Attendance.js';
import { Payment } from '../models/Payment.js';
import { pick } from '../middleware/validation.js';

const workerCreateFields = ['name', 'role', 'dailyWageRate', 'phone', 'siteId', 'isActive'];
const workerUpdateFields = ['name', 'role', 'dailyWageRate', 'phone', 'siteId', 'isActive'];

export const listWorkers = async (req, res) => {
  const { siteId, isActive, role } = req.query;
  const filter = { contractorId: req.user.userId };
  if (siteId) filter.siteId = siteId;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (role) filter.role = role;
  const workers = await Worker.find(filter).sort({ name: 1 });
  res.json({ workers });
};

export const getWorker = async (req, res) => {
  const worker = await Worker.findOne({
    _id: req.params.id,
    contractorId: req.user.userId,
  });
  if (!worker) throw Object.assign(new Error('Worker not found'), { statusCode: 404 });
  res.json({ worker });
};

export const createWorker = async (req, res) => {
  const { name, role, dailyWageRate, phone, siteId, isActive } = req.body || {};
  if (!name || !name.trim()) throw Object.assign(new Error('Worker name is required'), { statusCode: 400 });
  if (!role) throw Object.assign(new Error('Role is required'), { statusCode: 400 });
  if (!dailyWageRate || Number(dailyWageRate) <= 0) {
    throw Object.assign(new Error('Daily wage rate must be greater than 0'), { statusCode: 400 });
  }
  let site = null;
  if (siteId) {
    site = await Site.findOne({ _id: siteId, contractorId: req.user.userId });
    if (!site) throw Object.assign(new Error('Site not found'), { statusCode: 404 });
  }
  const worker = await Worker.create({
    name: name.trim(),
    role,
    dailyWageRate: Number(dailyWageRate),
    phone: phone ? phone.trim() : '',
    siteId: siteId || null,
    contractorId: req.user.userId,
    isActive: isActive !== false,
  });
  res.status(201).json({ worker });
};

export const updateWorker = async (req, res) => {
  const worker = await Worker.findOne({
    _id: req.params.id,
    contractorId: req.user.userId,
  });
  if (!worker) throw Object.assign(new Error('Worker not found'), { statusCode: 404 });
  if (req.body.siteId) {
    const site = await Site.findOne({ _id: req.body.siteId, contractorId: req.user.userId });
    if (!site) throw Object.assign(new Error('Site not found'), { statusCode: 404 });
  }
  const updated = await Worker.findOneAndUpdate(
    { _id: req.params.id, contractorId: req.user.userId },
    { $set: pick(req.body, workerUpdateFields) },
    { new: true, runValidators: true }
  );
  res.json({ worker: updated });
};

export const deactivateWorker = async (req, res) => {
  const worker = await Worker.findOneAndUpdate(
    { _id: req.params.id, contractorId: req.user.userId },
    { $set: { isActive: false } },
    { new: true }
  );
  if (!worker) throw Object.assign(new Error('Worker not found'), { statusCode: 404 });
  res.json({ worker });
};

export const getWorkerProfile = async (req, res) => {
  const worker = await Worker.findOne({
    _id: req.params.id,
    contractorId: req.user.userId,
  });
  if (!worker) throw Object.assign(new Error('Worker not found'), { statusCode: 404 });

  const attendance = await Attendance.find({ workerId: worker._id, contractorId: req.user.userId })
    .sort({ date: -1 })
    .limit(200);
  const payments = await Payment.find({ workerId: worker._id, contractorId: req.user.userId })
    .sort({ date: -1 })
    .limit(200);

  const totalPresent = attendance.filter((a) => a.status === 'present').length;
  const totalHalf = attendance.filter((a) => a.status === 'half-day').length;
  const totalEarnings =
    totalPresent * worker.dailyWageRate + totalHalf * worker.dailyWageRate * 0.5;
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  res.json({
    worker,
    attendanceHistory: attendance,
    paymentHistory: payments,
    summary: { totalPresent, totalHalf, totalEarnings, totalPaid, pending: totalEarnings - totalPaid },
  });
};
