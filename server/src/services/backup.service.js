import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { EJSON } from 'bson';

// Logical backup of every collection as Extended JSON (keeps ObjectIds and Dates), gzipped.
// Atlas M0 has no automated backups, so this is the safety net; restore needs an explicit confirm.

const stamp = (now) =>
  now
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')
    .replace(/:/g, '-');

export async function backupDatabase(db, { dir, now = new Date() }) {
  const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'))
    .sort();
  const data = {};
  const counts = {};
  for (const name of collections) {
    data[name] = await db.collection(name).find({}).toArray();
    counts[name] = data[name].length;
  }
  const payload = {
    format: 'mazdoorpay-backup/1',
    createdAt: now,
    database: db.databaseName,
    collections: data,
  };
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `mazdoorpay-${stamp(now)}.json.gz`);
  await fs.writeFile(file, gzipSync(EJSON.stringify(payload, { relaxed: false })));
  return { file, counts };
}

export async function restoreDatabase(db, { file, confirm = false }) {
  if (!confirm)
    throw new Error('Restore replaces the collections in the backup. Pass confirm to proceed.');
  const payload = EJSON.parse(gunzipSync(await fs.readFile(file)).toString('utf8'), {
    relaxed: false,
  });
  if (payload.format !== 'mazdoorpay-backup/1') throw new Error('Not a MazdoorPay backup file');
  const counts = {};
  for (const [name, docs] of Object.entries(payload.collections)) {
    const collection = db.collection(name);
    await collection.deleteMany({});
    if (docs.length) await collection.insertMany(docs, { ordered: false });
    counts[name] = docs.length;
  }
  return counts;
}
