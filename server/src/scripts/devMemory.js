// Runs the API against a throwaway in-memory MongoDB filled with the demo data.
// Handy before an Atlas cluster exists: npm run dev:memory -w server
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGODB_URI = replSet.getUri();
process.env.JWT_ACCESS_SECRET ||= 'dev-only-access-secret-change-me-0123456789';
process.env.QR_SECRET ||= 'dev-only-qr-secret-change-me-0123456789';

const { config } = await import('../config/env.js');
const { connectDB } = await import('../db.js');
const { createApp } = await import('../app.js');
const { runSeed } = await import('../seed/runSeed.js');

await connectDB(config.mongoUri);
await runSeed({ log: (line) => console.log(line) });

// Optional real (non-demo) admin, for the end-to-end tests: the demo admin only sees demo accounts.
if (process.env.DEV_ADMIN_EMAIL && process.env.DEV_ADMIN_PASSWORD) {
  const bcrypt = (await import('bcryptjs')).default;
  const { User } = await import('../models/User.js');
  await User.create({
    name: 'Operations Admin',
    email: process.env.DEV_ADMIN_EMAIL,
    role: 'admin',
    passwordHash: await bcrypt.hash(process.env.DEV_ADMIN_PASSWORD, config.bcryptCost),
  });
}
createApp().listen(config.port, () =>
  console.log(`MazdoorPay API (in-memory DB) on http://localhost:${config.port}`)
);

const stop = async () => {
  await replSet.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
