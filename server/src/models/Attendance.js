import { Schema, model } from 'mongoose';

const ATTENDANCE_STATUS = ['present', 'absent', 'half-day'];

const attendanceSchema = new Schema(
  {
    workerId: { type: Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },
    siteId: { type: Schema.Types.ObjectId, ref: 'Site', required: true, index: true },
    contractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    status: { type: String, enum: ATTENDANCE_STATUS, required: true },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

attendanceSchema.index({ workerId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ siteId: 1, date: 1 });
attendanceSchema.index({ contractorId: 1, date: 1 });

export const Attendance = model('Attendance', attendanceSchema);
