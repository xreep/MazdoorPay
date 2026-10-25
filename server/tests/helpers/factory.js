import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';

let appInstance;
export const app = () => (appInstance ??= createApp());

let counter = 0;
export const uniqueEmail = (prefix = 'user') => `${prefix}${Date.now()}${++counter}@example.com`;

export const DEFAULT_PASSWORD = 'Passw0rd123';

// Registers a contractor through the API. The agent keeps the refresh cookie.
export async function registerContractor(overrides = {}) {
  const agent = request.agent(app());
  const body = {
    name: 'Ravi Kumar',
    email: uniqueEmail('contractor'),
    password: DEFAULT_PASSWORD,
    ...overrides,
  };
  const res = await agent.post('/api/v1/auth/register').send(body);
  if (res.status !== 201)
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { user: res.body.user, token: res.body.accessToken, agent, password: body.password };
}

export async function createAdminUser(overrides = {}) {
  const email = overrides.email ?? uniqueEmail('admin');
  const user = await User.create({
    name: 'Platform Admin',
    email,
    passwordHash: await bcrypt.hash(DEFAULT_PASSWORD, 4),
    role: 'admin',
    ...overrides,
  });
  const res = await request(app())
    .post('/api/v1/auth/login')
    .send({ email, password: DEFAULT_PASSWORD });
  if (res.status !== 200)
    throw new Error(`admin login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { user: res.body.user, token: res.body.accessToken, doc: user };
}

// Small wrapper so tests read as `api.get('/api/v1/sites')`.
export function authed(token) {
  const withAuth = (req) => req.set('Authorization', `Bearer ${token}`);
  return {
    get: (url) => withAuth(request(app()).get(url)),
    post: (url, body) => withAuth(request(app()).post(url)).send(body ?? {}),
    put: (url, body) => withAuth(request(app()).put(url)).send(body ?? {}),
    patch: (url, body) => withAuth(request(app()).patch(url)).send(body ?? {}),
    del: (url) => withAuth(request(app()).delete(url)),
  };
}

export const cookieValue = (res, name = 'mp_rt') => {
  const header = [].concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`));
  return header ? header.split(';')[0].slice(name.length + 1) : undefined;
};
