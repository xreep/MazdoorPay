import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { useTestDb } from '../helpers/db.js';
import { AuditLog } from '../../src/models/AuditLog.js';
import { recordAudit } from '../../src/services/audit.service.js';

useTestDb();

const actor = { id: new mongoose.Types.ObjectId().toString(), role: 'contractor' };

it('recordAudit stores an entry', async () => {
  await recordAudit({
    actor,
    contractorId: actor.id,
    action: 'site.create',
    entity: 'Site',
    entityId: actor.id,
    after: { name: 'X' },
    ip: '1.2.3.4',
  });
  const [entry] = await AuditLog.find().lean();
  expect(entry).toMatchObject({
    action: 'site.create',
    entity: 'Site',
    actorRole: 'contractor',
    ip: '1.2.3.4',
    after: { name: 'X' },
  });
  expect(String(entry.contractorId)).toBe(actor.id);
  expect(entry.at).toBeInstanceOf(Date);
});

it('recordAudit never throws when the write fails', async () => {
  const create = jest.spyOn(AuditLog, 'create').mockRejectedValueOnce(new Error('disk full'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(
    recordAudit({
      actor,
      contractorId: actor.id,
      action: 'site.create',
      entity: 'Site',
      entityId: actor.id,
    })
  ).resolves.toBeUndefined();
  expect(log).toHaveBeenCalled();
  create.mockRestore();
  log.mockRestore();
});
