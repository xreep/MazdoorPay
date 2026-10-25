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
  expect(path.basename(file)).toBe('mazdoorpay-2026-10-25T10-30-00Z.jsonl.gz');
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

const backupNow = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mp-backup-'));
  const result = await backupDatabase(mongoose.connection.db, { dir });
  return { ...result, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
};

it('streams large collections through in batches', async () => {
  const docs = Array.from({ length: 2500 }, (_, i) => ({ contractorId, name: `Site ${i}` }));
  await Site.collection.insertMany(docs);
  const { file, counts, cleanup } = await backupNow();
  expect(counts.sites).toBe(2500);
  await Site.deleteMany({});
  expect(await restoreDatabase(mongoose.connection.db, { file, confirm: true })).toMatchObject({
    sites: 2500,
  });
  expect(await Site.countDocuments()).toBe(2500);
  await cleanup();
});

it('refuses to restore into a different database unless forced', async () => {
  await Site.create({ contractorId, name: 'Prestige Lakeside' });
  const { file, cleanup } = await backupNow();
  const other = mongoose.connection.client.db(`${mongoose.connection.db.databaseName}-other`);
  await expect(restoreDatabase(other, { file, confirm: true })).rejects.toThrow(/force/);
  expect(await other.collection('sites').countDocuments()).toBe(0);
  await restoreDatabase(other, { file, confirm: true, force: true });
  expect(await other.collection('sites').countDocuments()).toBe(1);
  await other.dropDatabase();
  await cleanup();
});

it('a damaged backup is rejected before anything is deleted', async () => {
  await Site.create({ contractorId, name: 'Prestige Lakeside' });
  const { file, cleanup } = await backupNow();
  const bytes = await fs.readFile(file);
  await fs.writeFile(file, bytes.subarray(0, Math.floor(bytes.length / 2)));
  await expect(restoreDatabase(mongoose.connection.db, { file, confirm: true })).rejects.toThrow();
  expect(await Site.countDocuments()).toBe(1);
  await cleanup();
});
