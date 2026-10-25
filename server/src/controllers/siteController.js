import { Site } from '../models/Site.js';
import { Worker } from '../models/Worker.js';
import { Attendance } from '../models/Attendance.js';
import { Payment } from '../models/Payment.js';
import { pick } from '../middleware/validation.js';

const siteCreateFields = ['name', 'location', 'isActive'];
const siteUpdateFields = ['name', 'location', 'isActive'];

export const listSites = async (req, res) => {
  const { isActive } = req.query;
  const filter = { contractorId: req.user.userId };
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  const sites = await Site.find(filter).sort({ createdAt: -1 });
  res.json({ sites });
};

export const getSite = async (req, res) => {
  const site = await Site.findOne({ _id: req.params.id, contractorId: req.user.userId });
  if (!site) throw Object.assign(new Error('Site not found'), { statusCode: 404 });
  const [workerCount, attendanceCount, paymentCount] = await Promise.all([
    Worker.countDocuments({ siteId: site._id, contractorId: req.user.userId }),
    Attendance.countDocuments({ siteId: site._id, contractorId: req.user.userId }),
    Payment.countDocuments({ siteId: site._id, contractorId: req.user.userId }),
  ]);
  res.json({ site, stats: { workerCount, attendanceCount, paymentCount } });
};

export const createSite = async (req, res) => {
  const { name, location, isActive } = req.body || {};
  if (!name || !name.trim()) throw Object.assign(new Error('Site name is required'), { statusCode: 400 });
  const site = await Site.create({
    name: name.trim(),
    location: location ? location.trim() : '',
    contractorId: req.user.userId,
    isActive: isActive !== false,
  });
  res.status(201).json({ site });
};

export const updateSite = async (req, res) => {
  const site = await Site.findOneAndUpdate(
    { _id: req.params.id, contractorId: req.user.userId },
    { $set: pick(req.body, siteUpdateFields) },
    { new: true, runValidators: true }
  );
  if (!site) throw Object.assign(new Error('Site not found'), { statusCode: 404 });
  res.json({ site });
};

export const deleteSite = async (req, res) => {
  const site = await Site.findOne({ _id: req.params.id, contractorId: req.user.userId });
  if (!site) throw Object.assign(new Error('Site not found'), { statusCode: 404 });
  const workerCount = await Worker.countDocuments({ siteId: site._id, contractorId: req.user.userId });
  if (workerCount > 0) {
    throw Object.assign(new Error('Cannot delete site with assigned workers'), { statusCode: 400 });
  }
  await site.deleteOne();
  res.json({ message: 'Site deleted' });
};
