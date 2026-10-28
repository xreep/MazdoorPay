// Config is imported dynamically so an invalid environment prints one clear line, not a stack trace.
async function start() {
  const { config } = await import('./config/env.js');
  const { connectDB } = await import('./db.js');
  const { createApp } = await import('./app.js');

  await connectDB(config.mongoUri);
  createApp().listen(config.port, () => {
    console.log(`MazdoorPay API listening on port ${config.port} (${config.env})`);
  });

  // Demo accounts (the API is already serving): opt-in creation of the demo data on an empty
  // database, then the passwords from DEMO_PASSWORD / DEMO_ADMIN_PASSWORD applied to them.
  const { seedDemoIfMissing, syncDemoPasswords } = await import('./seed/runSeed.js');
  const log = (line) => console.log(`[seed] ${line}`);
  (async () => {
    if (process.env.SEED_DEMO_IF_MISSING === 'true') {
      const counts = await seedDemoIfMissing({ log });
      log(counts ? 'demo data created' : 'nothing to do');
    }
    await syncDemoPasswords({ log });
  })().catch((err) => console.error(`[seed] failed: ${err.message}`));
}

start().catch((err) => {
  console.error(`Failed to start: ${err.message}`);
  process.exit(1);
});
