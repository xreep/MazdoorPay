import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/index.js';

process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';
process.env.NODE_ENV = 'test';
process.env.AUTH_RATE_LIMIT_MAX = '10000';
process.env.RATE_LIMIT_MAX = '10000';

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) await c.deleteMany({});
});

const hash = (p) => bcrypt.hash(p, 10);
const signup = (body) => request(app).post('/api/auth/signup').send(body);
const login = (body) => request(app).post('/api/auth/login').send(body);
const authReq = (token) => ({
  get: (p) => request(app).get(p).set('Authorization', `Bearer ${token}`),
  post: (p) => request(app).post(p).set('Authorization', `Bearer ${token}`),
  patch: (p) => request(app).patch(p).set('Authorization', `Bearer ${token}`),
});

describe('Auth', () => {
  it('signup creates user and returns tokens', async () => {
    const res = await signup({
      name: 'Ravi Contractor',
      email: 'ravi@example.com',
      password: 'Password123',
      phone: '9876543210',
      role: 'contractor',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('ravi@example.com');
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('rejects duplicate email', async () => {
    await signup({ name: 'A', email: 'a@example.com', password: 'Password123' });
    const res = await signup({ name: 'B', email: 'a@example.com', password: 'Password123' });
    expect(res.status).toBe(409);
  });

  it('login succeeds with correct password', async () => {
    await signup({ name: 'A', email: 'a@example.com', password: 'Password123' });
    const res = await login({ email: 'a@example.com', password: 'Password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('rejects wrong password', async () => {
    await signup({ name: 'A', email: 'a@example.com', password: 'Password123' });
    const res = await login({ email: 'a@example.com', password: 'WrongPass123' });
    expect(res.status).toBe(401);
  });

  it('refresh token rotation issues new tokens', async () => {
    await signup({ name: 'A', email: 'a@example.com', password: 'Password123' });
    const loginRes = await login({ email: 'a@example.com', password: 'Password123' });
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTruthy();
    expect(refreshRes.body.refreshToken).toBeTruthy();
    expect(refreshRes.body.refreshToken).not.toBe(loginRes.body.refreshToken);
  });

  it('rejects reuse of revoked refresh token', async () => {
    await signup({ name: 'A', email: 'a@example.com', password: 'Password123' });
    const loginRes = await login({ email: 'a@example.com', password: 'Password123' });
    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });
    const reuseRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });
    expect(reuseRes.status).toBe(401);
  });

  it('admin-only route blocks contractor', async () => {
    await signup({ name: 'A', email: 'a@example.com', password: 'Password123' });
    const res = await login({ email: 'a@example.com', password: 'Password123' });
    const token = res.body.accessToken;
    const adminRes = await authReq(token).get('/api/admin/dashboard');
    expect(adminRes.status).toBe(403);
  });
});

describe('Contractor data isolation', () => {
  it('contractor A cannot see contractor B workers', async () => {
    const hashP = await hash('Password123');
    const u1 = await mongoose.connection.db.collection('users').insertOne({
      name: 'A', email: 'a@example.com', passwordHash: hashP, role: 'contractor',
    });
    const u2 = await mongoose.connection.db.collection('users').insertOne({
      name: 'B', email: 'b@example.com', passwordHash: hashP, role: 'contractor',
    });
    await mongoose.connection.db.collection('workers').insertMany([
      { name: 'W1', role: 'labourer', dailyWageRate: 400, phone: '1', siteId: null, contractorId: u1.insertedId, isActive: true, joinedAt: new Date() },
      { name: 'W2', role: 'labourer', dailyWageRate: 400, phone: '1', siteId: null, contractorId: u2.insertedId, isActive: true, joinedAt: new Date() },
    ]);

    const loginRes = await login({ email: 'a@example.com', password: 'Password123' });
    const token = loginRes.body.accessToken;
    const res = await authReq(token).get('/api/workers');
    expect(res.status).toBe(200);
    expect(res.body.workers.length).toBe(1);
    expect(res.body.workers[0].name).toBe('W1');
  });
});

describe('Sites', () => {
  let token;
  beforeEach(async () => {
    await signup({ name: 'A', email: 'a@example.com', password: 'Password123' });
    const res = await login({ email: 'a@example.com', password: 'Password123' });
    token = res.body.accessToken;
  });

  it('creates and lists sites', async () => {
    const c = await authReq(token).post('/api/sites').send({ name: 'Site One', location: 'Bengaluru' });
    expect(c.status).toBe(201);
    const list = await authReq(token).get('/api/sites');
    expect(list.body.sites.length).toBe(1);
  });

  it('rejects duplicate site name for same contractor', async () => {
    await authReq(token).post('/api/sites').send({ name: 'Site One', location: 'Bengaluru' });
    const res = await authReq(token).post('/api/sites').send({ name: 'Site One', location: 'Mumbai' });
    expect(res.status).toBe(409);
  });
});

describe('Workers', () => {
  let token, siteId;
  beforeEach(async () => {
    await signup({ name: 'A', email: 'a@example.com', password: 'Password123' });
    const res = await login({ email: 'a@example.com', password: 'Password123' });
    token = res.body.accessToken;
    const c = await authReq(token).post('/api/sites').send({ name: 'Site One', location: 'Bengaluru' });
    siteId = c.body.site._id;
  });

  it('creates worker with valid wage', async () => {
    const res = await authReq(token)
      .post('/api/workers')
      .send({ name: 'Ramesh', role: 'labourer', dailyWageRate: 450, phone: '9999999999', siteId });
    expect(res.status).toBe(201);
    expect(res.body.worker.dailyWageRate).toBe(450);
  });

  it('rejects wage rate <= 0', async () => {
    const res = await authReq(token)
      .post('/api/workers')
      .send({ name: 'Ramesh', role: 'labourer', dailyWageRate: 0, siteId });
    expect(res.status).toBe(400);
  });

  it('deactivate keeps history', async () => {
    const w = await authReq(token)
      .post('/api/workers')
      .send({ name: 'Ramesh', role: 'labourer', dailyWageRate: 450, siteId });
    const workerId = w.body.worker._id;
    await authReq(token).patch(`/api/workers/${workerId}/deactivate`);
    const res = await authReq(token).get(`/api/workers/${workerId}/profile`);
    expect(res.status).toBe(200);
    expect(res.body.worker.isActive).toBe(false);
  });
});

describe('Attendance', () => {
  let token, workerId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  beforeEach(async () => {
    await signup({ name: 'A', email: 'a@example.com', password: 'Password123' });
    const res = await login({ email: 'a@example.com', password: 'Password123' });
    token = res.body.accessToken;
    const c = await authReq(token).post('/api/sites').send({ name: 'Site One', location: 'Bengaluru' });
    const siteId = c.body.site._id;
    const w = await authReq(token)
      .post('/api/workers')
      .send({ name: 'Ramesh', role: 'labourer', dailyWageRate: 400, siteId });
    workerId = w.body.worker._id;
  });

  it('marks attendance for workers', async () => {
    const res = await authReq(token)
      .post('/api/attendance')
      .send({ date: today.toISOString(), records: [{ workerId, status: 'present' }] });
    expect(res.status).toBe(200);
    expect(res.body.marked).toBe(1);
  });

  it('rejects future date', async () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    future.setHours(0, 0, 0, 0);
    const res = await authReq(token)
      .post('/api/attendance')
      .send({ date: future.toISOString(), records: [{ workerId, status: 'present' }] });
    expect(res.status).toBe(400);
  });

  it('enforces one record per worker per date', async () => {
    await authReq(token)
      .post('/api/attendance')
      .send({ date: today.toISOString(), records: [{ workerId, status: 'present' }] });
    await authReq(token)
      .post('/api/attendance')
      .send({ date: today.toISOString(), records: [{ workerId, status: 'absent' }] });
    const list = await authReq(token).get(`/api/attendance?workerId=${workerId}`);
    expect(list.body.attendance.length).toBe(1);
  });
});

describe('Wage math', () => {
  it('computes present=full, half=0.5, absent=0', async () => {
    const hashP = await hash('Password123');
    const u = await mongoose.connection.db.collection('users').insertOne({
      name: 'A', email: 'a@example.com', passwordHash: hashP, role: 'contractor',
    });
    const site = await mongoose.connection.db.collection('sites').insertOne({
      name: 'Site', location: 'X', contractorId: u.insertedId, isActive: true,
    });
    const w = await mongoose.connection.db.collection('workers').insertOne({
      name: 'Ramesh', role: 'labourer', dailyWageRate: 400, phone: '1',
      siteId: site.insertedId, contractorId: u.insertedId, isActive: true, joinedAt: new Date(),
    });
    const d1 = new Date(); d1.setHours(0, 0, 0, 0);
    const d2 = new Date(d1); d2.setDate(d1.getDate() + 1);
    const d3 = new Date(d1); d3.setDate(d1.getDate() + 2);
    await mongoose.connection.db.collection('attendances').insertMany([
      { workerId: w.insertedId, siteId: site.insertedId, contractorId: u.insertedId, date: d1, status: 'present', markedBy: u.insertedId },
      { workerId: w.insertedId, siteId: site.insertedId, contractorId: u.insertedId, date: d2, status: 'half-day', markedBy: u.insertedId },
      { workerId: w.insertedId, siteId: site.insertedId, contractorId: u.insertedId, date: d3, status: 'absent', markedBy: u.insertedId },
    ]);
    const loginRes = await login({ email: 'a@example.com', password: 'Password123' });
    const token = loginRes.body.accessToken;
    const res = await authReq(token).get(`/api/wages/worker?workerId=${w.insertedId}`);
    expect(res.status).toBe(200);
    expect(res.body.daysPresent).toBe(1);
    expect(res.body.halfDays).toBe(1);
    expect(res.body.totalEarnings).toBe(400 + 200);
    expect(res.body.absentDays).toBe(1);
  });
});

describe('Payments', () => {
  it('records payment and rejects overpayment', async () => {
    const hashP = await hash('Password123');
    const u = await mongoose.connection.db.collection('users').insertOne({
      name: 'A', email: 'a@example.com', passwordHash: hashP, role: 'contractor',
    });
    const site = await mongoose.connection.db.collection('sites').insertOne({
      name: 'Site', location: 'X', contractorId: u.insertedId, isActive: true,
    });
    const w = await mongoose.connection.db.collection('workers').insertOne({
      name: 'Ramesh', role: 'labourer', dailyWageRate: 400, phone: '1',
      siteId: site.insertedId, contractorId: u.insertedId, isActive: true, joinedAt: new Date(),
    });
    const d = new Date(); d.setHours(0, 0, 0, 0);
    await mongoose.connection.db.collection('attendances').insertOne({
      workerId: w.insertedId, siteId: site.insertedId, contractorId: u.insertedId,
      date: d, status: 'present', markedBy: u.insertedId,
    });
    const loginRes = await login({ email: 'a@example.com', password: 'Password123' });
    const token = loginRes.body.accessToken;

    const pay = await authReq(token)
      .post('/api/payments')
      .send({ workerId: w.insertedId, amount: 400, method: 'cash', notes: 'wk1' });
    expect(pay.status).toBe(201);

    const over = await authReq(token)
      .post('/api/payments')
      .send({ workerId: w.insertedId, amount: 900, method: 'cash', notes: 'too much' });
    expect(over.status).toBe(400);
  });
});
