import request from 'supertest';
import jwt from 'jsonwebtoken';
import { useTestDb } from '../helpers/db.js';
import {
  app,
  authed,
  cookieValue,
  registerContractor,
  uniqueEmail,
  DEFAULT_PASSWORD,
} from '../helpers/factory.js';
import { User } from '../../src/models/User.js';
import { RefreshToken } from '../../src/models/RefreshToken.js';

useTestDb();

const register = (body) => request(app()).post('/api/v1/auth/register').send(body);
const login = (email, password, agent = request(app())) =>
  agent.post('/api/v1/auth/login').send({ email, password });
const refreshWith = (raw) =>
  request(app())
    .post('/api/v1/auth/refresh')
    .set('Cookie', raw ? `mp_rt=${raw}` : '');

describe('register', () => {
  it('ignores role and creates a contractor', async () => {
    const res = await register({
      name: 'Asha',
      email: uniqueEmail(),
      password: DEFAULT_PASSWORD,
      role: 'admin',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('contractor');
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toBeUndefined();
  });

  it('enforces password policy', async () => {
    expect(
      (await register({ name: 'Asha', email: uniqueEmail(), password: 'password' })).status
    ).toBe(400);
    expect(
      (await register({ name: 'Asha', email: uniqueEmail(), password: '12345678' })).status
    ).toBe(400);
    expect(
      (await register({ name: 'Asha', email: uniqueEmail(), password: `a1${'x'.repeat(71)}` }))
        .status
    ).toBe(400);
    expect(
      (await register({ name: 'Asha', email: uniqueEmail(), password: 'abcdefg1' })).status
    ).toBe(201);
  });

  it('rejects bad email, short name and bad phone', async () => {
    const res = await register({
      name: 'A',
      email: 'nope',
      password: DEFAULT_PASSWORD,
      phone: '12345',
    });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.path).sort()).toEqual(['email', 'name', 'phone']);
  });

  it('rejects duplicate email case-insensitively', async () => {
    const email = uniqueEmail();
    expect(
      (await register({ name: 'Asha', email: email.toUpperCase(), password: DEFAULT_PASSWORD }))
        .status
    ).toBe(201);
    const dup = await register({ name: 'Asha', email, password: DEFAULT_PASSWORD });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('An account with this email already exists');
  });
});

describe('login and refresh', () => {
  it('sets httpOnly refresh cookie scoped to /api/v1/auth', async () => {
    const { user } = await registerContractor();
    const res = await login(user.email, DEFAULT_PASSWORD);
    expect(res.status).toBe(200);
    const cookie = [].concat(res.headers['set-cookie']).find((c) => c.startsWith('mp_rt='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.body.user).toMatchObject({
      email: user.email,
      role: 'contractor',
      preferredLanguage: 'en',
    });
  });

  it('refresh rotates the cookie', async () => {
    const { user } = await registerContractor();
    const first = cookieValue(await login(user.email, DEFAULT_PASSWORD));
    const res = await refreshWith(first);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    const second = cookieValue(res);
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    await RefreshToken.updateMany({ revokedAt: { $ne: null } }, { revokedAt: new Date(Date.now() - 60_000) });
    expect((await refreshWith(first)).status).toBe(401);
  });

  it('after logout even a recently rotated cookie is refused', async () => {
    const { user } = await registerContractor();
    const a = cookieValue(await login(user.email, DEFAULT_PASSWORD));
    const b = cookieValue(await refreshWith(a));
    await request(app()).post('/api/v1/auth/logout').set('Cookie', `mp_rt=${b}`);
    expect((await refreshWith(a)).status).toBe(401);
    expect((await refreshWith(b)).status).toBe(401);
  });

  it('reusing a rotated token after the grace window revokes the whole family', async () => {
    const { user } = await registerContractor();
    const a = cookieValue(await login(user.email, DEFAULT_PASSWORD));
    const b = cookieValue(await refreshWith(a));
    await RefreshToken.updateMany(
      { revokedAt: { $ne: null } },
      { revokedAt: new Date(Date.now() - 60_000) }
    );
    expect((await refreshWith(a)).status).toBe(401);
    expect((await refreshWith(b)).status).toBe(401);
  });

  it('a cookie replaced moments ago (lost response, second tab) still gets a fresh session', async () => {
    const { user } = await registerContractor();
    const a = cookieValue(await login(user.email, DEFAULT_PASSWORD));
    const b = cookieValue(await refreshWith(a));
    const late = await refreshWith(a);
    expect(late.status).toBe(200);
    const c = cookieValue(late);
    expect(c).toBeDefined();
    expect(c).not.toBe(b);
    expect((await refreshWith(b)).status).toBe(200);
    expect((await refreshWith(c)).status).toBe(200);
  });

  it('sessions are independent families', async () => {
    const { user } = await registerContractor();
    const x = cookieValue(await login(user.email, DEFAULT_PASSWORD));
    const y = cookieValue(await login(user.email, DEFAULT_PASSWORD));
    const out = await request(app()).post('/api/v1/auth/logout').set('Cookie', `mp_rt=${x}`);
    expect(out.status).toBe(204);
    expect((await refreshWith(x)).status).toBe(401);
    expect((await refreshWith(y)).status).toBe(200);
  });

  it('refresh without a cookie is 401', async () => {
    expect((await refreshWith()).status).toBe(401);
    expect((await refreshWith('garbage')).status).toBe(401);
  });

  it('locks after 5 failed logins with 423', async () => {
    const { user } = await registerContractor();
    for (let i = 0; i < 5; i++) expect((await login(user.email, 'Wrong1234')).status).toBe(401);
    const locked = await login(user.email, DEFAULT_PASSWORD);
    expect(locked.status).toBe(423);
    expect(locked.body.error).toMatch(/Too many failed attempts/);
  });

  it('a successful login clears earlier failures', async () => {
    const { user } = await registerContractor();
    for (let i = 0; i < 4; i++) await login(user.email, 'Wrong1234');
    expect((await login(user.email, DEFAULT_PASSWORD)).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await login(user.email, 'Wrong1234')).status).toBe(401);
    expect((await login(user.email, DEFAULT_PASSWORD)).status).toBe(200);
  });

  it('wrong email and wrong password give the same message', async () => {
    const { user } = await registerContractor();
    const wrongPass = await login(user.email, 'Wrong1234');
    const wrongEmail = await login(uniqueEmail('ghost'), DEFAULT_PASSWORD);
    expect(wrongPass.status).toBe(401);
    expect(wrongEmail.status).toBe(401);
    expect(wrongPass.body).toEqual(wrongEmail.body);
  });

  it('login email is case-insensitive', async () => {
    const { user } = await registerContractor();
    expect((await login(user.email.toUpperCase(), DEFAULT_PASSWORD)).status).toBe(200);
  });

  it('suspended user cannot log in, refresh, or use access token', async () => {
    const { user, token } = await registerContractor();
    const raw = cookieValue(await login(user.email, DEFAULT_PASSWORD));
    await User.updateOne(
      { _id: user._id },
      { status: 'suspended', suspendedReason: 'Fake workers' }
    );
    const res = await login(user.email, DEFAULT_PASSWORD);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Your account is suspended');
    expect((await refreshWith(raw)).status).toBe(401);
    const me = await authed(token).get('/api/v1/auth/me');
    expect(me.status).toBe(401);
    expect(me.body.error).toBe('Your account is suspended');
  });
});

describe('me', () => {
  it('PATCH /auth/me is audited', async () => {
    const { token, user } = await registerContractor();
    await authed(token).patch('/api/v1/auth/me', { name: 'Ravi K' });
    const { AuditLog } = await import('../../src/models/AuditLog.js');
    const entry = await AuditLog.findOne({ action: 'user.update' }).lean();
    expect(String(entry.entityId)).toBe(user._id);
    expect(entry.after).toMatchObject({ name: 'Ravi K' });
  });

  it('GET /auth/me never returns passwordHash', async () => {
    const { token, user } = await registerContractor({ phone: '9876543210' });
    const res = await authed(token).get('/api/v1/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ _id: user._id, phone: '9876543210' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('PATCH /auth/me updates language and rejects role', async () => {
    const { token } = await registerContractor();
    const res = await authed(token).patch('/api/v1/auth/me', {
      preferredLanguage: 'hi',
      role: 'admin',
      name: 'Ravi K',
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      preferredLanguage: 'hi',
      role: 'contractor',
      name: 'Ravi K',
    });
    expect((await authed(token).patch('/api/v1/auth/me', { preferredLanguage: 'fr' })).status).toBe(
      400
    );
  });

  it('requires a bearer token', async () => {
    expect((await request(app()).get('/api/v1/auth/me')).status).toBe(401);
    expect((await authed('garbage').get('/api/v1/auth/me')).status).toBe(401);
  });

  it('access token signed with another secret is rejected', async () => {
    const { user } = await registerContractor();
    const forged = jwt.sign({ role: 'admin' }, 'some-other-secret-0123456789', {
      subject: user._id,
      expiresIn: '15m',
    });
    const res = await authed(forged).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Please log in again');
  });

  it('a token for a deleted user is rejected', async () => {
    const { token, user } = await registerContractor();
    await User.deleteOne({ _id: user._id });
    expect((await authed(token).get('/api/v1/auth/me')).status).toBe(401);
  });
});
