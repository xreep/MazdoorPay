import crypto from 'node:crypto';
import { addDays, todayIST } from '@mazdoorpay/shared';
import { Attendance } from '../models/Attendance.js';
import { Payment } from '../models/Payment.js';
import { StatementLink } from '../models/StatementLink.js';
import { User } from '../models/User.js';
import { Worker } from '../models/Worker.js';
import { httpError } from '../utils/httpError.js';
import { hashToken } from '../utils/tokens.js';
import { recordAudit } from './audit.service.js';
import { getBalance } from './ledger.service.js';
import { getWorker } from './worker.service.js';

const WINDOW_DAYS = 90;
const TOKEN_BYTES = 32;
const GONE = 'This link is not valid any more. Ask your contractor for a new one.';

const active = (contractorId, workerId) => ({ contractorId, workerId, revokedAt: null });

// A new link always replaces the worker's previous one.
export async function createLink(ctx, workerId) {
  const { worker } = await getWorker(ctx.contractorId, workerId);
  await StatementLink.updateMany(active(ctx.contractorId, worker._id), { revokedAt: new Date() });
  const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  await StatementLink.create({
    contractorId: ctx.contractorId,
    workerId: worker._id,
    tokenHash: hashToken(token),
    createdBy: ctx.actor.id,
  });
  await recordAudit({ ...ctx, action: 'statement.create', entity: 'Worker', entityId: worker._id });
  return { token, path: `/s/${token}` };
}

export async function linkStatus(contractorId, workerId) {
  const { worker } = await getWorker(contractorId, workerId);
  const link = await StatementLink.findOne(active(contractorId, worker._id)).lean();
  return link
    ? { active: true, createdAt: link.createdAt, lastViewedAt: link.lastViewedAt }
    : { active: false };
}

export async function revokeLink(ctx, workerId) {
  const { worker } = await getWorker(ctx.contractorId, workerId);
  const { modifiedCount } = await StatementLink.updateMany(active(ctx.contractorId, worker._id), {
    revokedAt: new Date(),
  });
  if (modifiedCount)
    await recordAudit({
      ...ctx,
      action: 'statement.revoke',
      entity: 'Worker',
      entityId: worker._id,
    });
  return { active: false };
}

// The public page: the worker's all-time balance and their last 90 days, nothing else.
export async function readStatement(token) {
  const link =
    typeof token === 'string' && token.length <= 100
      ? await StatementLink.findOneAndUpdate(
          { tokenHash: hashToken(token), revokedAt: null },
          { lastViewedAt: new Date() }
        ).lean()
      : null;
  if (!link) throw httpError(404, GONE);

  const since = addDays(todayIST(), -(WINDOW_DAYS - 1));
  const scope = { contractorId: link.contractorId, workerId: link.workerId, day: { $gte: since } };
  const [worker, contractor, balance, days, payments] = await Promise.all([
    Worker.findById(link.workerId).select('name role preferredLanguage').lean(),
    User.findById(link.contractorId).select('name').lean(),
    getBalance(link.contractorId, link.workerId),
    Attendance.find(scope).sort({ day: -1 }).lean(),
    Payment.find(scope).sort({ day: -1, createdAt: -1 }).lean(),
  ]);
  if (!worker || !contractor) throw httpError(404, GONE);
  return {
    worker: { name: worker.name, role: worker.role, preferredLanguage: worker.preferredLanguage },
    contractor: { name: contractor.name },
    since,
    balance,
    days: days.map((d) => ({ day: d.day, status: d.status, earned: d.earned })),
    payments: payments.map((p) => ({
      day: p.day,
      amount: p.amount,
      type: p.type,
      method: p.method,
      reference: p.reference ?? null,
      voided: Boolean(p.voidedAt),
    })),
  };
}
