import { Schema, model } from 'mongoose';

const WORKER_ROLES = [
  'mason', 'labourer', 'electrician', 'plumber', 'carpenter',
  'painter', 'welder', 'helper', 'other',
];

const workerSchema = new Schema(
  {
    name: { type: String, required: [true, 'Worker name is required'], trim: true, maxlength: 150 },
    role: {
      type: String,
      enum: WORKER_ROLES,
      required: [true, 'Role is required'],
    },
    dailyWageRate: {
      type: Number,
      required: [true, 'Daily wage rate is required'],
      min: [0, 'Wage rate must be positive'],
    },
    phone: { type: String, trim: true, maxlength: 20 },
    siteId: { type: Schema.Types.ObjectId, ref: 'Site', index: true },
    contractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isActive: { type: Boolean, default: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

workerSchema.index({ contractorId: 1, siteId: 1 });
workerSchema.index({ contractorId: 1, isActive: 1 });

export const Worker = model('Worker', workerSchema);
