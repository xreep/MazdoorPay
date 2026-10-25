import { Schema, model } from 'mongoose';
import { LANGUAGES, WORKER_ROLES } from '@mazdoorpay/shared';

const rateEntrySchema = new Schema(
  {
    rate: { type: Number, required: true },
    effectiveFrom: { type: String, required: true },
    setAt: { type: Date, default: Date.now },
    setBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const workerSchema = new Schema(
  {
    contractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    siteId: { type: Schema.Types.ObjectId, ref: 'Site', default: null },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    role: { type: String, enum: WORKER_ROLES, required: true },
    // Current rate (paise); always equals the latest rateHistory entry.
    dailyRate: { type: Number, required: true },
    rateHistory: { type: [rateEntrySchema], default: [] },
    phone: { type: String, trim: true },
    upiId: { type: String, trim: true },
    preferredLanguage: { type: String, enum: LANGUAGES, default: 'en' },
    joinedOn: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    // IST day the worker was last deactivated; cleared on reactivation.
    deactivatedOn: { type: String, default: null },
    qrVersion: { type: Number, default: 1 },
    // Bumped inside every money-affecting transaction so concurrent writers conflict.
    ledgerVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

workerSchema.index({ contractorId: 1, isActive: 1, name: 1 });
workerSchema.index({ contractorId: 1, siteId: 1 });

export const Worker = model('Worker', workerSchema);
