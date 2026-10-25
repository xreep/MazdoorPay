// Usage: npm run restore -w server -- --file backups/mazdoorpay-….jsonl.gz --confirm [--force]
// Stop the API first, so nothing writes while collections are being replaced.
import { parseArgs } from 'node:util';

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      confirm: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      dir: { type: 'string', default: 'backups' },
    },
  });
  if (!values.file) throw new Error('Pass --file <backup.jsonl.gz>');
  const { config } = await import('../config/env.js');
  const { connectDB, disconnectDB } = await import('../db.js');
  const mongoose = (await import('mongoose')).default;
  const { backupDatabase, restoreDatabase } = await import('../services/backup.service.js');
  await connectDB(config.mongoUri);
  try {
    const { db, host } = mongoose.connection;
    console.log(`Target: database "${db.databaseName}" on ${host}`);
    if (values.confirm) {
      // The restore cannot be undone, so keep what is there now.
      const { file } = await backupDatabase(db, { dir: values.dir });
      console.log(`Current data saved to ${file}`);
    }
    const counts = await restoreDatabase(db, {
      file: values.file,
      confirm: values.confirm,
      force: values.force,
    });
    console.log('Restored', counts);
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error(`Restore failed: ${err.message}`);
  process.exit(1);
});
