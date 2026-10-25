import { Schema, model } from 'mongoose';

const PAYMENT_METHODS = ['cash', 'upi', 'bank'];

const paymentSchema = new Schema(
  {
    workerId: { type: Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },
    siteId: { type: Schema.Types.ObjectId, ref: 'Site', index: true },
    contractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: [0, 'Amount must be positive'] },
    date: { type: Date, required: true, default: Date.now },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    notes: { type: String, trim: true, maxlength: 500 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

paymentSchema.index({ contractorId: 1, date: -1 });
paymentSchema.index({ workerId: 1, date: -1 });

export const Payment = model('Payment', paymentSchema);
