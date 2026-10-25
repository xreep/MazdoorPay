import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';
import mongoose from 'mongoose';

// Logical backup of every collection as Extended JSON (keeps ObjectIds and Dates), gzipped.
// Atlas M0 has no automated backups, so this is the safety net; restore needs an explicit confirm.
// EJSON comes from the driver Mongoose uses, so its BSON types always match what the driver accepts.
const { EJSON } = mongoose.mongo.BSON;

// One line per document after a header line, streamed both ways, so memory use stays flat
// however large the database grows.
const FORMAT = 'mazdoorpay-backup/2';
const INSERT_BATCH = 1000;

const stamp = (now) =>
  now
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')
    .replace(/:/g, '-');

const toLine = (value) => `${EJSON.stringify(value, { relaxed: false })}\n`;

export async function backupDatabase(db, { dir, now = new Date() }) {
  const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'))
    .sort();
  const counts = Object.fromEntries(collections.map((name) => [name, 0]));
  async function* lines() {
    yield toLine({ format: FORMAT, createdAt: now, database: db.databaseName, collections });
    for (const name of collections) {
      for await (const doc of db.collection(name).find({})) {
        counts[name] += 1;
        yield toLine({ c: name, d: doc });
      }
    }
  }
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `mazdoorpay-${stamp(now)}.jsonl.gz`);
  await pipeline(Readable.from(lines()), createGzip(), createWriteStream(file));
  return { file, counts };
}

async function* readBackup(file) {
  const gunzip = createGunzip();
  const reading = pipeline(createReadStream(file), gunzip);
  reading.catch(() => {}); // a read error also ends the line reader below, which throws it
  for await (const text of readline.createInterface({ input: gunzip, crlfDelay: Infinity })) {
    if (text) yield EJSON.parse(text, { relaxed: false });
  }
  await reading;
}

export async function restoreDatabase(db, { file, confirm = false, force = false }) {
  if (!confirm)
    throw new Error('Restore replaces the collections in the backup. Pass confirm to proceed.');

  // Read the whole file once first, so a damaged backup fails before anything is deleted.
  let header;
  for await (const entry of readBackup(file)) {
    if (!header) {
      if (entry.format !== FORMAT) throw new Error('Not a MazdoorPay backup file');
      header = { ...entry, counts: Object.fromEntries(entry.collections.map((c) => [c, 0])) };
    } else header.counts[entry.c] = (header.counts[entry.c] ?? 0) + 1;
  }
  if (!header) throw new Error('Not a MazdoorPay backup file');
  if (header.database !== db.databaseName && !force)
    throw new Error(
      `This backup is of database "${header.database}", not "${db.databaseName}". Pass force to restore it here anyway.`
    );

  for (const name of Object.keys(header.counts)) await db.collection(name).deleteMany({});
  let collection;
  let batch = [];
  const flush = async () => {
    if (batch.length) await db.collection(collection).insertMany(batch, { ordered: false });
    batch = [];
  };
  let isHeader = true;
  for await (const entry of readBackup(file)) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    if (entry.c !== collection || batch.length >= INSERT_BATCH) {
      await flush();
      collection = entry.c;
    }
    batch.push(entry.d);
  }
  await flush();
  return header.counts;
}
