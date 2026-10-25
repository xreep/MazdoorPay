import { Schema, model } from 'mongoose';

// A private, revocable link that lets one worker see their own statement without logging in.
// Only a SHA-256 hash of the token is stored; the link itself is shown once, when made.
const statementLinkSchema = new Schema(
  {
    contractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workerId: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    tokenHash: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    revokedAt: { type: Date, default: null },
    lastViewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

statementLinkSchema.index({ contractorId: 1, workerId: 1, revokedAt: 1 });

export const StatementLink = model('StatementLink', statementLinkSchema);
