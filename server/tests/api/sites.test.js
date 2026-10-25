import mongoose from 'mongoose';
import { useTestDb } from '../helpers/db.js';
import { authed, registerContractor } from '../helpers/factory.js';
import { AuditLog } from '../../src/models/AuditLog.js';

useTestDb();

let a;
let b;
beforeEach(async () => {
  const ra = await registerContractor({ name: 'Ravi Kumar' });
  const rb = await registerContractor({ name: 'Sunita Patil' });
  a = { ...ra, api: authed(ra.token) };
  b = { ...rb, api: authed(rb.token) };
});

const createSite = (api, body = {}) =>
  api.post('/api/v1/sites', {
    name: 'Prestige Lakeside',
    location: 'Whitefield, Bengaluru',
    ...body,
  });

const insertWorker = (contractorId, siteId, isActive = true) =>
  mongoose.connection
    .collection('workers')
    .insertOne({
      contractorId: new mongoose.Types.ObjectId(contractorId),
      siteId: new mongoose.Types.ObjectId(siteId),
      name: 'Ramesh',
      isActive,
    });

describe('sites', () => {
  it('create, list with worker counts, get with stats', async () => {
    const res = await createSite(a.api);
    expect(res.status).toBe(201);
    const site = res.body.site;
    expect(site).toMatchObject({
      name: 'Prestige Lakeside',
      location: 'Whitefield, Bengaluru',
      isActive: true,
    });
    await insertWorker(a.user._id, site._id, true);
    await insertWorker(a.user._id, site._id, false);
    await createSite(a.api, { name: 'Sobha Tower' });

    const list = await a.api.get('/api/v1/sites');
    expect(list.status).toBe(200);
    expect(list.body.sites).toHaveLength(2);
    const lake = list.body.sites.find((s) => s.name === 'Prestige Lakeside');
    expect(lake).toMatchObject({ activeWorkers: 1, totalWorkers: 2 });
    expect(list.body.sites.find((s) => s.name === 'Sobha Tower')).toMatchObject({
      activeWorkers: 0,
      totalWorkers: 0,
    });

    const one = await a.api.get(`/api/v1/sites/${site._id}`);
    expect(one.status).toBe(200);
    expect(one.body.stats).toEqual({
      activeWorkers: 1,
      totalWorkers: 2,
      attendanceRecords: 0,
      payments: 0,
    });
  });

  it('filters by status', async () => {
    const s = (await createSite(a.api)).body.site;
    await createSite(a.api, { name: 'Sobha Tower' });
    await a.api.patch(`/api/v1/sites/${s._id}`, { isActive: false });
    expect((await a.api.get('/api/v1/sites?status=active')).body.sites.map((x) => x.name)).toEqual([
      'Sobha Tower',
    ]);
    expect(
      (await a.api.get('/api/v1/sites?status=inactive')).body.sites.map((x) => x.name)
    ).toEqual(['Prestige Lakeside']);
    expect((await a.api.get('/api/v1/sites?status=all')).body.sites).toHaveLength(2);
    expect((await a.api.get('/api/v1/sites?status=bogus')).status).toBe(400);
  });

  it('validates input', async () => {
    expect((await createSite(a.api, { name: 'X' })).status).toBe(400);
    expect((await createSite(a.api, { location: 'y'.repeat(301) })).status).toBe(400);
    expect((await a.api.patch('/api/v1/sites/not-an-id', { name: 'Okay name' })).status).toBe(400);
  });

  it('patch updates fields', async () => {
    const s = (await createSite(a.api)).body.site;
    const res = await a.api.patch(`/api/v1/sites/${s._id}`, { name: 'Prestige Lakeside Phase 2' });
    expect(res.status).toBe(200);
    expect(res.body.site.name).toBe('Prestige Lakeside Phase 2');
  });

  it('duplicate name per contractor is 409, case-insensitive; other contractor may reuse it', async () => {
    await createSite(a.api);
    const dup = await createSite(a.api, { name: 'prestige lakeside' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('You already have a site with this name');
    expect((await createSite(b.api)).status).toBe(201);
  });

  it("another contractor's site is 404", async () => {
    const s = (await createSite(a.api)).body.site;
    expect((await b.api.get(`/api/v1/sites/${s._id}`)).status).toBe(404);
    expect((await b.api.patch(`/api/v1/sites/${s._id}`, { name: 'Hijack' })).status).toBe(404);
    expect((await b.api.del(`/api/v1/sites/${s._id}`)).status).toBe(404);
    expect((await b.api.get('/api/v1/sites')).body.sites).toHaveLength(0);
  });

  it('delete works for an empty site and is blocked when a worker exists', async () => {
    const empty = (await createSite(a.api, { name: 'Empty Site' })).body.site;
    expect((await a.api.del(`/api/v1/sites/${empty._id}`)).status).toBe(204);
    expect((await a.api.get(`/api/v1/sites/${empty._id}`)).status).toBe(404);

    const used = (await createSite(a.api)).body.site;
    await insertWorker(a.user._id, used._id);
    const res = await a.api.del(`/api/v1/sites/${used._id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('This site has workers or records. Mark it inactive instead.');
  });

  it('admins cannot use contractor site routes', async () => {
    const { createAdminUser } = await import('../helpers/factory.js');
    const admin = await createAdminUser();
    expect((await authed(admin.token).get('/api/v1/sites')).status).toBe(403);
  });
});

describe('audit trail', () => {
  it('each site write creates one audit entry with before/after', async () => {
    const s = (await createSite(a.api)).body.site;
    await a.api.patch(`/api/v1/sites/${s._id}`, { location: 'Varthur Road' });
    await a.api.del(`/api/v1/sites/${s._id}`);
    const entries = await AuditLog.find({ entity: 'Site' }).sort({ at: 1, _id: 1 }).lean();
    expect(entries.map((e) => e.action)).toEqual(['site.create', 'site.update', 'site.delete']);
    for (const e of entries) {
      expect(String(e.contractorId)).toBe(a.user._id);
      expect(String(e.actorId)).toBe(a.user._id);
      expect(String(e.entityId)).toBe(s._id);
    }
    expect(entries[0].after.name).toBe('Prestige Lakeside');
    expect(entries[1].before.location).toBe('Whitefield, Bengaluru');
    expect(entries[1].after.location).toBe('Varthur Road');
    expect(entries[2].before.name).toBe('Prestige Lakeside');
  });

  it('register and login are audited', async () => {
    const { DEFAULT_PASSWORD } = await import('../helpers/factory.js');
    await a.agent
      .post('/api/v1/auth/login')
      .send({ email: a.user.email, password: DEFAULT_PASSWORD });
    const actions = (await AuditLog.find({ actorId: a.user._id }).lean())
      .map((e) => e.action)
      .sort();
    expect(actions).toEqual(['auth.login', 'auth.register']);
  });
});
