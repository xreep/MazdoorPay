import { MongoMemoryReplSet } from 'mongodb-memory-server';

export default async function globalSetup() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  globalThis.__MONGO__ = replSet;
  process.env.MONGO_TEST_URI = replSet.getUri();
}
