// Config is imported dynamically so an invalid environment prints one clear line, not a stack trace.
async function start() {
  const { config } = await import('./config/env.js');
  const { connectDB } = await import('./db.js');
  const { createApp } = await import('./app.js');

  await connectDB(config.mongoUri);
  createApp().listen(config.port, () => {
    console.log(`MazdoorPay API listening on port ${config.port} (${config.env})`);
  });
}

start().catch((err) => {
  console.error(`Failed to start: ${err.message}`);
  process.exit(1);
});
