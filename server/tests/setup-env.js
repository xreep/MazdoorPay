// Runs before any test module is imported, so config/env.js sees these values.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:1/unused';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef';
process.env.QR_SECRET = 'test-qr-secret-0123456789abcdef';
process.env.BCRYPT_COST = '4';
process.env.RATE_LIMIT_MAX = '100000';
process.env.AUTH_RATE_LIMIT_MAX = '100000';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
// Throwaway demo passwords for the tests; real ones are set only on the server.
process.env.DEMO_PASSWORD = 'Test-demo-2026';
process.env.DEMO_ADMIN_PASSWORD = 'Test-admin-2026';
