import { Payment } from '../models/Payment.js';
import { Worker } from '../models/Worker.js';
import { Attendance } from '../models/Attendance.js';

export const recordPayment = async (req, res) => {
  const { workerId, amount, date, method, notes } = req.body || {};
  if (!workerId) throw Object.assign(new Error('Worker is required'), { statusCode: 400 });
  if (!amount || Number(amount) <= 0) throw Object.assign(new Error('Amount must be greater than 0'), { statusCode: 400 });
  if (!method || !['cash', 'upi', 'bank'].includes(method)) {
    throw Object.assign(new Error('Valid payment method is required'), { statusCode: 400 });
  }

  const worker = await Worker.findOne({
    _id: workerId,
    contractorId: req.user.userId,
  });
  if (!worker) throw Object.assign(new Error('Worker not found'), { statusCode: 404 });

  // Compute pending dues for worker
  const records = await Attendance.find({ workerId: worker._id, contractorId: req.user.userId });
  let totalEarnings = 0;
  for (const r of records) {
    if (r.status === 'present') totalEarnings += worker.dailyWageRate;
    else if (r.status === 'half-day') totalEarnings += worker.dailyWageRate * 0.5;
  }
  const payments = await Payment.find({ workerId: worker._id, contractorId: req.user.userId });
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const pending = totalEarnings - totalPaid;

  const amountNum = Number(amount);
  if (amountNum > pending) {
    throw Object.assign(new Error(`Cannot pay ₹${amountNum}. Pending dues are ₹${pending}.`), { statusCode: 400 });
  }

  const paymentDate = date ? new Date(date) : new Date();
  const payment = await Payment.create({
    workerId: worker._id,
    siteId: worker.siteId || null,
    contractorId: req.user.userId,
    amount: amountNum,
    date: paymentDate,
    method,
    notes: notes ? notes.trim() : '',
    recordedBy: req.user.userId,
  });

  res.status(201).json({ payment, pending: pending - amountNum });
};

export const listPayments = async (req, res) => {
  const { workerId, start, end } = req.query;
  const filter = { contractorId: req.user.userId };
  if (workerId) filter.workerId = workerId;
  if (start || end) {
    filter.date = {};
    if (start) filter.date.$gte = new Date(start);
    if (end) filter.date.$lte = new Date(end);
  }
  const payments = await Payment.find(filter).sort({ date: -1 });
  res.json({ payments });
};

export const pendingDues = async (req, res) => {
  const { siteId } = req.query;
  const workerFilter = { contractorId: req.user.userId, isActive: true };
  if (siteId) workerFilter.siteId = siteId;
  const workers = await Worker.find(workerFilter);

  const dues = [];
  for (const worker of workers) {
    const records = await Attendance.find({ workerId: worker._id, contractorId: req.user.userId });
    let totalEarnings = 0;
    for (const r of records) {
      if (r.status === 'present') totalEarnings += worker.dailyWageRate;
      else if (r.status === 'half-day') totalEarnings += worker.dailyWageRate * 0.5;
    }
    const payments = await Payment.find({ workerId: worker._id, contractorId: req.user.userId });
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const pending = totalEarnings - totalPaid;
    if (pending > 0) {
      dues.push({
        workerId: worker._id,
        workerName: worker.name,
        role: worker.role,
        siteId: worker.siteId,
        totalEarnings,
        totalPaid,
        pending,
      });
    }
  }
  dues.sort((a, b) => b.pending - a.pending);
  res.json({ dues });
};
