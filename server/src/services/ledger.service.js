import mongoose from 'mongoose';
import { Attendance } from '../models/Attendance.js';
import { Payment } from '../models/Payment.js';

const { ObjectId } = mongoose.Types;

export const emptyBalance = () => ({ earned: 0, paidWage: 0, paidAdvance: 0, paid: 0, balance: 0 });

// Balance per worker = all earnings − all non-voided payments (wages and advances).
// Positive means the contractor owes the worker; negative means an advance is outstanding.
export async function getBalances(contractorId, { workerIds, session } = {}) {
  const match = { contractorId: new ObjectId(String(contractorId)) };
  if (workerIds) match.workerId = { $in: workerIds.map((id) => new ObjectId(String(id))) };

  const [earnings, payments] = await Promise.all([
    Attendance.aggregate([
      { $match: match },
      { $group: { _id: '$workerId', earned: { $sum: '$earned' } } },
    ]).session(session ?? null),
    Payment.aggregate([
      { $match: { ...match, voidedAt: null } },
      { $group: { _id: { workerId: '$workerId', type: '$type' }, total: { $sum: '$amount' } } },
    ]).session(session ?? null),
  ]);

  const balances = new Map((workerIds ?? []).map((id) => [String(id), emptyBalance()]));
  const entry = (id) => {
    const key = String(id);
    if (!balances.has(key)) balances.set(key, emptyBalance());
    return balances.get(key);
  };
  for (const e of earnings) entry(e._id).earned = e.earned;
  for (const p of payments) {
    const b = entry(p._id.workerId);
    if (p._id.type === 'wage') b.paidWage = p.total;
    else b.paidAdvance = p.total;
  }
  for (const b of balances.values()) {
    b.paid = b.paidWage + b.paidAdvance;
    b.balance = b.earned - b.paid;
  }
  return balances;
}

export async function getBalance(contractorId, workerId, session) {
  const balances = await getBalances(contractorId, { workerIds: [workerId], session });
  return balances.get(String(workerId));
}
