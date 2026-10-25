import { Schema, model } from 'mongoose';

// Append-only record of every write. `contractorId` is the tenant the change belongs to.
const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String },
    contractorId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String },
    at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

auditLogSchema.index({ contractorId: 1, at: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, at: -1 });
auditLogSchema.index({ action: 1, at: -1 });

export const AuditLog = model('AuditLog', auditLogSchema);
