// CLI: npm run seed — replaces the demo accounts, with passwords from DEMO_PASSWORD and
// DEMO_ADMIN_PASSWORD.
async function main() {
  const { config } = await import('../config/env.js');
  const { connectDB, disconnectDB } = await import('../db.js');
  const { runSeed } = await import('./runSeed.js');
  await connectDB(config.mongoUri);
  try {
    await runSeed({ log: (line) => console.log(line) });
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
