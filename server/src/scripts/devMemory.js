// Runs the API against a throwaway in-memory MongoDB filled with the demo data.
// Handy before an Atlas cluster exists: npm run dev:memory -w server
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGODB_URI = replSet.getUri();
process.env.JWT_ACCESS_SECRET ||= 'dev-only-access-secret-change-me-0123456789';
process.env.QR_SECRET ||= 'dev-only-qr-secret-change-me-0123456789';
// Local-only demo passwords for this throwaway database (the hosted ones are set on the server).
process.env.DEMO_PASSWORD ||= 'Local-demo-2026';
process.env.DEMO_ADMIN_PASSWORD ||= 'Local-admin-2026';

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
createApp().listen(config.port, () => {
  console.log(`MazdoorPay API (in-memory DB) on http://localhost:${config.port}`);
  console.log(
    `Demo logins: ravi.kumar@mazdoorpay.in or sunita.patil@mazdoorpay.in / ${config.demoPassword}; admin@mazdoorpay.in / ${config.demoAdminPassword}`
  );
});

const stop = async () => {
  await replSet.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
