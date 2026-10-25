// Usage: npm run create-admin -w server -- --name "Asha Rao" --email asha@example.com --password 'S3cure-pass'
import { parseArgs } from 'node:util';
import bcrypt from 'bcryptjs';
import { registerSchema } from '@mazdoorpay/shared';

async function main() {
  const { values } = parseArgs({
    options: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' } },
  });
  const parsed = registerSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((i) => `--${i.path.join('.')}: ${i.message}`).join('; ')
    );
  }

  const { config } = await import('../config/env.js');
  const { connectDB, disconnectDB } = await import('../db.js');
  const { User } = await import('../models/User.js');

  await connectDB(config.mongoUri);
  try {
    const { name, email, password } = parsed.data;
    if (await User.exists({ email })) throw new Error(`A user with email ${email} already exists`);
    await User.create({
      name,
      email,
      role: 'admin',
      passwordHash: await bcrypt.hash(password, config.bcryptCost),
    });
    console.log(`Admin created: ${email}`);
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error(`Could not create admin: ${err.message}`);
  process.exit(1);
});
