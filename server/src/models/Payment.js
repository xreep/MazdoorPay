import { Schema, model } from 'mongoose';
import { PAYMENT_METHODS, PAYMENT_TYPES } from '@mazdoorpay/shared';

// Payments are never edited or deleted; mistakes are voided with a reason.
const paymentSchema = new Schema(
  {
    contractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workerId: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    siteId: { type: Schema.Types.ObjectId, ref: 'Site', default: null },
    day: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    type: { type: String, enum: PAYMENT_TYPES, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    reference: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 500 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    idempotencyKey: { type: String, required: true },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    voidReason: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

paymentSchema.index({ contractorId: 1, idempotencyKey: 1 }, { unique: true });
paymentSchema.index({ contractorId: 1, day: -1 });
paymentSchema.index({ workerId: 1, day: -1 });

export const Payment = model('Payment', paymentSchema);
