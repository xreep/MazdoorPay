import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../../src/db.js';

// Gives each test file its own database on the shared replica set and a clean slate per test.
export function useTestDb() {
  beforeAll(async () => {
    const dbName = `mp_${process.env.JEST_WORKER_ID}_${crypto.randomBytes(4).toString('hex')}`;
    await connectDB(process.env.MONGO_TEST_URI, { dbName });
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  });

  beforeEach(async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await disconnectDB();
  });
}
