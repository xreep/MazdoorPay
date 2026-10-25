import mongoose from 'mongoose';
import { formatINR, todayIST } from '@mazdoorpay/shared';
import { Payment } from '../models/Payment.js';
import { Worker } from '../models/Worker.js';
import { Site } from '../models/Site.js';
import { User } from '../models/User.js';
import { httpError } from '../utils/httpError.js';
import { pageResult, skipFor } from '../utils/pagination.js';
import { pick, recordAudit } from './audit.service.js';
import { getBalance, getBalances } from './ledger.service.js';
import { findOwnedSite } from './site.service.js';

const AUDIT_FIELDS = ['workerId', 'amount', 'type', 'method', 'reference', 'day', 'notes'];

const samePayment = (existing, input) =>
  String(existing.workerId) === input.workerId &&
  existing.amount === input.amount &&
  existing.type === input.type;

async function replayOf(contractorId, input, session) {
  const existing = await Payment.findOne({ contractorId, idempotencyKey: input.idempotencyKey })
    .session(session ?? null)
    .lean();
  if (!existing) return null;
  if (!samePayment(existing, input))
    throw httpError(409, 'This request key was already used for a different payment');
  return existing;
}

// Records a wage payment or advance. The worker's ledgerVersion bump makes two concurrent
// payments for the same worker conflict, so the loser retries and re-checks the dues.
export async function recordPayment({ actor, contractorId, input, ip }) {
  let result;
  try {
    await mongoose.connection.transaction(async (session) => {
      const replay = await replayOf(contractorId, input, session);
      if (replay) {
        result = {
          payment: replay,
          balance: await getBalance(contractorId, replay.workerId, session),
          replayed: true,
        };
        return;
      }

      const worker = await Worker.findOneAndUpdate(
        { _id: input.workerId, contractorId },
        { $inc: { ledgerVersion: 1 } },
        { session, new: true }
      ).lean();
      if (!worker) throw httpError(404, 'Worker not found');

      const day = input.day ?? todayIST();
      if (day > todayIST())
        throw httpError(400, 'Payment date cannot be in the future', [
          { path: 'day', message: 'Future date' },
        ]);
      if (day < worker.joinedOn)
        throw httpError(400, 'Payment date is before the worker joined', [
          { path: 'day', message: 'Too early' },
        ]);

      const before = await getBalance(contractorId, worker._id, session);
      const dues = Math.max(before.balance, 0);
      if (input.type === 'wage' && input.amount > dues) {
        throw httpError(
          400,
          `Amount is more than pending dues (${formatINR(dues)}). Record the extra as an advance.`,
          [{ path: 'amount', message: `Pending dues are ${formatINR(dues)}` }]
        );
      }

      const { idempotencyKey, ...fields } = input;
      const [payment] = await Payment.create(
        [
          {
            ...fields,
            day,
            idempotencyKey,
            contractorId,
            siteId: worker.siteId ?? null,
            recordedBy: actor.id,
          },
        ],
        { session }
      );
      await recordAudit({
        actor,
        contractorId,
        ip,
        session,
        action: 'payment.create',
        entity: 'Payment',
        entityId: payment._id,
        after: pick(payment, AUDIT_FIELDS),
      });
      result = {
        payment: payment.toObject(),
        balance: await getBalance(contractorId, worker._id, session),
        replayed: false,
      };
    });
  } catch (err) {
    // Lost a race against the same key: the other request's payment is the answer.
    if (err.code === 11000) {
      const replay = await replayOf(contractorId, input);
      if (replay)
        return {
          payment: replay,
          balance: await getBalance(contractorId, replay.workerId),
          replayed: true,
        };
    }
    throw err;
  }
  return result;
}

export async function voidPayment({ actor, contractorId, paymentId, reason, ip }) {
  let result;
  await mongoose.connection.transaction(async (session) => {
    const payment = await Payment.findOne({ _id: paymentId, contractorId }).session(session);
    if (!payment) throw httpError(404, 'Payment not found');
    if (payment.voidedAt) throw httpError(409, 'This payment is already void');

    await Worker.updateOne({ _id: payment.workerId }, { $inc: { ledgerVersion: 1 } }, { session });
    payment.set({ voidedAt: new Date(), voidedBy: actor.id, voidReason: reason });
    await payment.save({ session });
    await recordAudit({
      actor,
      contractorId,
      ip,
      session,
      action: 'payment.void',
      entity: 'Payment',
      entityId: payment._id,
      before: pick(payment, AUDIT_FIELDS),
      after: { voidReason: reason },
    });
    result = {
      payment: payment.toObject(),
      balance: await getBalance(contractorId, payment.workerId, session),
    };
  });
  return result;
}

export async function listPayments(
  contractorId,
  { workerId, siteId, from, to, method, type, includeVoided, page, limit }
) {
  const filter = { contractorId };
  if (workerId) filter.workerId = workerId;
  if (siteId) filter.siteId = siteId;
  if (method) filter.method = method;
  if (type) filter.type = type;
  if (!includeVoided) filter.voidedAt = null;
  if (from || to) filter.day = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .sort({ day: -1, createdAt: -1 })
      .skip(skipFor({ page, limit }))
      .limit(limit)
      .populate({ path: 'workerId', select: 'name role' })
      .lean(),
    Payment.countDocuments(filter),
  ]);
  const data = items.map(({ workerId: w, ...rest }) => ({
    ...rest,
    workerId: w?._id ?? null,
    worker: w ? { name: w.name, role: w.role } : null,
  }));
  return pageResult(data, total, { page, limit });
}

export async function getPayment(contractorId, paymentId) {
  const payment = await Payment.findOne({ _id: paymentId, contractorId }).lean();
  if (!payment) throw httpError(404, 'Payment not found');
  const [worker, site, contractor] = await Promise.all([
    Worker.findById(payment.workerId).select('name role phone upiId preferredLanguage').lean(),
    payment.siteId ? Site.findById(payment.siteId).select('name location').lean() : null,
    User.findById(contractorId).select('name phone').lean(),
  ]);
  return {
    payment,
    worker,
    site,
    contractor: { name: contractor?.name, phone: contractor?.phone ?? null },
  };
}

// Who is owed money and who holds an advance, including inactive workers with an open balance.
export async function getDues(contractorId, { siteId } = {}) {
  const filter = { contractorId };
  if (siteId) {
    await findOwnedSite(contractorId, siteId);
    filter.siteId = siteId;
  }
  const workers = await Worker.find(filter)
    .select('name role siteId isActive')
    .sort({ name: 1 })
    .lean();
  const [balances, sites] = await Promise.all([
    getBalances(contractorId, { workerIds: workers.map((w) => w._id) }),
    Site.find({ contractorId }).select('name').lean(),
  ]);
  const siteName = new Map(sites.map((s) => [String(s._id), s.name]));

  const rows = workers.map((w) => {
    const b = balances.get(String(w._id));
    return {
      workerId: String(w._id),
      name: w.name,
      role: w.role,
      isActive: w.isActive,
      siteId: w.siteId ? String(w.siteId) : null,
      siteName: w.siteId ? (siteName.get(String(w.siteId)) ?? null) : null,
      earned: b.earned,
      paid: b.paid,
      balance: b.balance,
    };
  });
  const dues = rows.filter((r) => r.balance > 0).sort((x, y) => y.balance - x.balance);
  const advances = rows.filter((r) => r.balance < 0).sort((x, y) => x.balance - y.balance);
  return {
    dues,
    advances,
    totals: {
      pending: dues.reduce((s, r) => s + r.balance, 0),
      advance: advances.reduce((s, r) => s - r.balance, 0),
      workersWithDues: dues.length,
    },
  };
}
