import mongoose from 'mongoose';

export async function connectDB(uri, options = {}) {
  await mongoose.connect(uri, { dbName: 'mazdoorpay', ...options });
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
