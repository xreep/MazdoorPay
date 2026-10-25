import { AuditLog } from '../models/AuditLog.js';

// Copies only the named fields so audit entries stay small and never include secrets.
export const pick = (doc, fields) => {
  if (!doc) return undefined;
  const source = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return Object.fromEntries(
    fields.filter((f) => source[f] !== undefined).map((f) => [f, source[f]])
  );
};

// Auditing must never break the write it describes, so failures are logged and swallowed.
export async function recordAudit({
  actor,
  contractorId,
  action,
  entity,
  entityId,
  before,
  after,
  ip,
  session,
}) {
  try {
    const entry = {
      actorId: actor?.id,
      actorRole: actor?.role,
      contractorId,
      action,
      entity,
      entityId,
      before,
      after,
      ip,
    };
    await AuditLog.create([entry], session ? { session } : undefined);
  } catch (err) {
    console.error(`audit write failed for ${action}:`, err.message);
  }
}
