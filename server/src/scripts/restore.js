// Usage: npm run restore -w server -- --file backups/mazdoorpay-….json.gz --confirm
import { parseArgs } from 'node:util';

async function main() {
  const { values } = parseArgs({
    options: { file: { type: 'string' }, confirm: { type: 'boolean', default: false } },
  });
  if (!values.file) throw new Error('Pass --file <backup.json.gz>');
  const { config } = await import('../config/env.js');
  const { connectDB, disconnectDB } = await import('../db.js');
  const mongoose = (await import('mongoose')).default;
  const { restoreDatabase } = await import('../services/backup.service.js');
  await connectDB(config.mongoUri);
  try {
    const counts = await restoreDatabase(mongoose.connection.db, {
      file: values.file,
      confirm: values.confirm,
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
