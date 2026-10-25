import { Schema, model } from 'mongoose';

const siteSchema = new Schema(
  {
    name: { type: String, required: [true, 'Site name is required'], trim: true, maxlength: 150 },
    location: { type: String, trim: true, maxlength: 300 },
    contractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

siteSchema.index({ contractorId: 1, name: 1 }, { unique: true });

export const Site = model('Site', siteSchema);
