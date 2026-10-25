import { Schema, model } from 'mongoose';

const loginAttemptSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    attempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date },
  },
  { timestamps: true }
);

// Stale counters disappear after a day.
loginAttemptSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const LoginAttempt = model('LoginAttempt', loginAttemptSchema);
