// Config is imported dynamically so an invalid environment prints one clear line, not a stack trace.
async function start() {
  const { config } = await import('./config/env.js');
  const { connectDB } = await import('./db.js');
  const { createApp } = await import('./app.js');

  await connectDB(config.mongoUri);
  createApp().listen(config.port, () => {
    console.log(`MazdoorPay API listening on port ${config.port} (${config.env})`);
  });

  // Opt-in: fill an empty database with the demo accounts once (the API is already serving).
  if (process.env.SEED_DEMO_IF_MISSING === 'true') {
    const { seedDemoIfMissing } = await import('./seed/runSeed.js');
    seedDemoIfMissing({ log: (line) => console.log(`[seed] ${line}`) })
      .then((counts) => console.log(counts ? '[seed] demo data created' : '[seed] nothing to do'))
      .catch((err) => console.error(`[seed] failed: ${err.message}`));
  }
}

start().catch((err) => {
  console.error(`Failed to start: ${err.message}`);
  process.exit(1);
});
