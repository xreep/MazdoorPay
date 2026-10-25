import { Schema, model } from 'mongoose';

const loginAttemptSchema = new Schema(
  {
    email: { type: String, required: true, index: true },
    attempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date },
  },
  { timestamps: true }
);

loginAttemptSchema.index({ email: 1 }, { unique: true });

export const LoginAttempt = model('LoginAttempt', loginAttemptSchema);
