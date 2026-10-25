import { Schema, model } from 'mongoose';
import { LANGUAGES, USER_ROLES, USER_STATUSES } from '@mazdoorpay/shared';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    role: { type: String, enum: USER_ROLES, default: 'contractor' },
    status: { type: String, enum: USER_STATUSES, default: 'active' },
    suspendedReason: { type: String, trim: true, maxlength: 200 },
    lastLoginAt: { type: Date },
    preferredLanguage: { type: String, enum: LANGUAGES, default: 'en' },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, createdAt: -1 });

export const User = model('User', userSchema);
