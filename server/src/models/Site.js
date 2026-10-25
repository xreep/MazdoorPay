import { Schema, model } from 'mongoose';

const siteSchema = new Schema(
  {
    contractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    location: { type: String, trim: true, maxlength: 300, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Site names are unique per contractor, ignoring case.
siteSchema.index(
  { contractorId: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

export const Site = model('Site', siteSchema);
