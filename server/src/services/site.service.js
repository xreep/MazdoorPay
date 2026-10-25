import mongoose from 'mongoose';
import { Site } from '../models/Site.js';
import { Worker } from '../models/Worker.js';
import { Attendance } from '../models/Attendance.js';
import { Payment } from '../models/Payment.js';
import { httpError } from '../utils/httpError.js';
import { pick, recordAudit } from './audit.service.js';

const FIELDS = ['name', 'location', 'isActive'];
const { ObjectId } = mongoose.Types;

const duplicateName = (err) => {
  if (err.code === 11000)
    return httpError(409, 'You already have a site with this name', [
      { path: 'name', message: 'Already used' },
    ]);
  return err;
};

export async function findOwnedSite(contractorId, siteId) {
  const site = await Site.findOne({ _id: siteId, contractorId });
  if (!site) throw httpError(404, 'Site not found');
  return site;
}

export async function listSites(contractorId, { status }) {
  const match = { contractorId: new ObjectId(contractorId) };
  if (status !== 'all') match.isActive = status === 'active';
  return Site.aggregate([
    { $match: match },
    {
      $lookup: {
        from: Worker.collection.name,
        let: { siteId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$siteId', '$$siteId'] } } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: { $sum: { $cond: ['$isActive', 1, 0] } },
            },
          },
        ],
        as: 'counts',
      },
    },
    {
      $addFields: {
        totalWorkers: { $ifNull: [{ $first: '$counts.total' }, 0] },
        activeWorkers: { $ifNull: [{ $first: '$counts.active' }, 0] },
      },
    },
    { $project: { counts: 0 } },
    { $sort: { isActive: -1, name: 1 } },
  ]).collation({ locale: 'en', strength: 2 });
}

export async function getSite(contractorId, siteId) {
  const site = await findOwnedSite(contractorId, siteId);
  const [totalWorkers, activeWorkers, attendanceRecords, payments] = await Promise.all([
    Worker.countDocuments({ contractorId, siteId }),
    Worker.countDocuments({ contractorId, siteId, isActive: true }),
    Attendance.countDocuments({ contractorId, siteId }),
    Payment.countDocuments({ contractorId, siteId }),
  ]);
  return {
    site: site.toObject(),
    stats: { activeWorkers, totalWorkers, attendanceRecords, payments },
  };
}

export async function createSite(ctx, input) {
  const site = await Site.create({ ...input, contractorId: ctx.contractorId }).catch((err) => {
    throw duplicateName(err);
  });
  await recordAudit({
    ...ctx,
    action: 'site.create',
    entity: 'Site',
    entityId: site._id,
    after: pick(site, FIELDS),
  });
  return site.toObject();
}

export async function updateSite(ctx, siteId, changes) {
  const site = await findOwnedSite(ctx.contractorId, siteId);
  const before = pick(site, FIELDS);
  site.set(changes);
  await site.save().catch((err) => {
    throw duplicateName(err);
  });
  await recordAudit({
    ...ctx,
    action: 'site.update',
    entity: 'Site',
    entityId: site._id,
    before,
    after: pick(site, FIELDS),
  });
  return site.toObject();
}

export async function deleteSite(ctx, siteId) {
  const site = await findOwnedSite(ctx.contractorId, siteId);
  const scope = { contractorId: ctx.contractorId, siteId: site._id };
  const [worker, attendance, payment] = await Promise.all([
    Worker.exists(scope),
    Attendance.exists(scope),
    Payment.exists(scope),
  ]);
  if (worker || attendance || payment) {
    throw httpError(409, 'This site has workers or records. Mark it inactive instead.');
  }
  await site.deleteOne();
  await recordAudit({
    ...ctx,
    action: 'site.delete',
    entity: 'Site',
    entityId: site._id,
    before: pick(site, FIELDS),
  });
}
