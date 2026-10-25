import { Schema, model } from 'mongoose';
import { ATTENDANCE_STATUSES } from '@mazdoorpay/shared';

const attendanceSchema = new Schema(
  {
    contractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workerId: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    siteId: { type: Schema.Types.ObjectId, ref: 'Site', required: true },
    day: { type: String, required: true },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    // Rate in force on `day` and what that day earned, both in paise.
    rateSnapshot: { type: Number, required: true },
    earned: { type: Number, required: true },
    method: { type: String, enum: ['manual', 'qr'], default: 'manual' },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

attendanceSchema.index({ workerId: 1, day: 1 }, { unique: true });
attendanceSchema.index({ contractorId: 1, day: 1 });
attendanceSchema.index({ contractorId: 1, siteId: 1, day: 1 });

export const Attendance = model('Attendance', attendanceSchema);
