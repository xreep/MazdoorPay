import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import { useTestDb } from '../helpers/db.js';
import { backupDatabase, restoreDatabase } from '../../src/services/backup.service.js';
import { Site } from '../../src/models/Site.js';
import { Payment } from '../../src/models/Payment.js';

useTestDb();

const contractorId = new mongoose.Types.ObjectId();

it('backs up every collection and restores it exactly, types included', async () => {
  await Site.create({ contractorId, name: 'Prestige Lakeside', location: 'Bengaluru' });
  await Payment.create({
    contractorId,
    workerId: new mongoose.Types.ObjectId(),
    day: '2026-10-20',
    amount: 45000,
    type: 'wage',
    method: 'cash',
    recordedBy: contractorId,
    idempotencyKey: 'k1',
  });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mp-backup-'));
  const { file, counts } = await backupDatabase(mongoose.connection.db, {
    dir,
    now: new Date('2026-10-25T10:30:00Z'),
  });
  expect(path.basename(file)).toBe('mazdoorpay-2026-10-25T10-30-00Z.json.gz');
  expect(counts).toMatchObject({ sites: 1, payments: 1 });

  await Site.deleteMany({});
  await Payment.deleteMany({});
  await Site.create({ contractorId, name: 'Created after the backup' });

  await expect(restoreDatabase(mongoose.connection.db, { file })).rejects.toThrow(/confirm/);
  const restored = await restoreDatabase(mongoose.connection.db, { file, confirm: true });
  expect(restored).toMatchObject({ sites: 1, payments: 1 });

  const site = await Site.findOne().lean();
  expect(site.name).toBe('Prestige Lakeside');
  expect(site.contractorId).toBeInstanceOf(mongoose.Types.ObjectId);
  expect(site.createdAt).toBeInstanceOf(Date);
  expect((await Payment.findOne().lean()).amount).toBe(45000);
  await fs.rm(dir, { recursive: true, force: true });
});
