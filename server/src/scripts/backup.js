// Usage: npm run backup -w server [-- --dir backups]
import { parseArgs } from 'node:util';

async function main() {
  const { values } = parseArgs({ options: { dir: { type: 'string', default: 'backups' } } });
  const { config } = await import('../config/env.js');
  const { connectDB, disconnectDB } = await import('../db.js');
  const mongoose = (await import('mongoose')).default;
  const { backupDatabase } = await import('../services/backup.service.js');
  await connectDB(config.mongoUri);
  try {
    const { file, counts } = await backupDatabase(mongoose.connection.db, { dir: values.dir });
    console.log(`Backup written to ${file}`);
    console.log(counts);
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error(`Backup failed: ${err.message}`);
  process.exit(1);
});
