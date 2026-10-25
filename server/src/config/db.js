import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<user>')) {
    throw new Error('MONGODB_URI is not configured in .env');
  }
  await mongoose.connect(uri, {
    dbName: 'mazdoorpay',
  });
  // eslint-disable-next-line no-console
  console.log('MongoDB connected');
};

export default connectDB;
