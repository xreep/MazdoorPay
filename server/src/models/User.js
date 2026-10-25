import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 100 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    passwordHash: { type: String, required: true },
    phone: { type: String, trim: true, maxlength: 20 },
    role: { type: String, enum: ['contractor', 'admin'], default: 'contractor' },
  },
  { timestamps: true }
);

export const User = model('User', userSchema);
