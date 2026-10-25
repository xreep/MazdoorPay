import { addDays, todayIST } from '@mazdoorpay/shared';
import { useTestDb } from '../helpers/db.js';
import { authed, registerContractor } from '../helpers/factory.js';
import { Attendance } from '../../src/models/Attendance.js';
import { AuditLog } from '../../src/models/AuditLog.js';

useTestDb();

let a;
let b;
let siteA;
beforeEach(async () => {
  const ra = await registerContractor();
  const rb = await registerContractor();
  a = { ...ra, api: authed(ra.token) };
  b = { ...rb, api: authed(rb.token) };
  siteA = (await a.api.post('/api/v1/sites', { name: 'Prestige Lakeside' })).body.site;
});

const newWorker = (api, body = {}) =>
  api.post('/api/v1/workers', {
    name: 'Ramesh Yadav',
    role: 'mason',
    dailyRate: 80000,
    siteId: siteA._id,
    ...body,
  });

describe('create', () => {
  it('applies defaults: joinedOn today IST and one rate history entry', async () => {
    const res = await newWorker(a.api);
    expect(res.status).toBe(201);
    const w = res.body.worker;
    expect(w).toMatchObject({
      name: 'Ramesh Yadav',
      role: 'mason',
      dailyRate: 80000,
      joinedOn: todayIST(),
      isActive: true,
      qrVersion: 1,
      preferredLanguage: 'en',
    });
    expect(w.rateHistory).toHaveLength(1);
    expect(w.rateHistory[0]).toMatchObject({ rate: 80000, effectiveFrom: todayIST() });
    expect(w.ledgerVersion).toBeUndefined();
  });

  it('validates rate bounds and whole paise', async () => {
    for (const dailyRate of [4999, 1000001, 450.5, '80000'])
      expect((await newWorker(a.api, { dailyRate })).status).toBe(400);
    expect((await newWorker(a.api, { dailyRate: 5000 })).status).toBe(201);
  });

  it('validates phone, UPI ID and role', async () => {
    expect((await newWorker(a.api, { phone: '12345' })).status).toBe(400);
    expect((await newWorker(a.api, { phone: '9876543210' })).status).toBe(201);
    expect((await newWorker(a.api, { upiId: 'ramesh' })).status).toBe(400);
    expect((await newWorker(a.api, { upiId: 'ramesh@oksbi' })).status).toBe(201);
    expect((await newWorker(a.api, { role: 'pilot' })).status).toBe(400);
  });

  it('rejects a joining date in the future, accepts a past one', async () => {
    const future = await newWorker(a.api, { joinedOn: addDays(todayIST(), 1) });
    expect(future.status).toBe(400);
    expect(future.body.error).toBe('Joining date cannot be in the future');
    const past = await newWorker(a.api, { joinedOn: addDays(todayIST(), -30) });
    expect(past.status).toBe(201);
    expect(past.body.worker.rateHistory[0].effectiveFrom).toBe(addDays(todayIST(), -30));
  });

  it('site of another contractor is 404; no site is allowed', async () => {
    const siteB = (await b.api.post('/api/v1/sites', { name: 'Other Site' })).body.site;
    const res = await newWorker(a.api, { siteId: siteB._id });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Site not found');
    const unassigned = await newWorker(a.api, { siteId: undefined });
    expect(unassigned.status).toBe(201);
    expect(unassigned.body.worker.siteId).toBeNull();
  });

  it('is audited', async () => {
    const w = (await newWorker(a.api)).body.worker;
    const entry = await AuditLog.findOne({ action: 'worker.create' }).lean();
    expect(String(entry.entityId)).toBe(w._id);
    expect(entry.after).toMatchObject({ name: 'Ramesh Yadav', dailyRate: 80000 });
  });
});

describe('read and update', () => {
  it('GET returns worker with site', async () => {
    const w = (await newWorker(a.api)).body.worker;
    const res = await a.api.get(`/api/v1/workers/${w._id}`);
    expect(res.status).toBe(200);
    expect(res.body.worker._id).toBe(w._id);
    expect(res.body.site).toMatchObject({ _id: siteA._id, name: 'Prestige Lakeside' });
  });

  it('PATCH changes profile fields but never the rate', async () => {
    const w = (await newWorker(a.api)).body.worker;
    const res = await a.api.patch(`/api/v1/workers/${w._id}`, {
      name: 'Ramesh K Yadav',
      dailyRate: 99999,
      phone: '9876543210',
    });
    expect(res.status).toBe(200);
    expect(res.body.worker).toMatchObject({
      name: 'Ramesh K Yadav',
      dailyRate: 80000,
      phone: '9876543210',
    });
    const unassign = await a.api.patch(`/api/v1/workers/${w._id}`, { siteId: null });
    expect(unassign.body.worker.siteId).toBeNull();
  });

  it('PATCH joinedOn moves the first rate entry and is blocked by earlier records', async () => {
    const joined = addDays(todayIST(), -10);
    const w = (await newWorker(a.api, { joinedOn: joined })).body.worker;
    const earlier = addDays(todayIST(), -20);
    const moved = await a.api.patch(`/api/v1/workers/${w._id}`, { joinedOn: earlier });
    expect(moved.status).toBe(200);
    expect(moved.body.worker.joinedOn).toBe(earlier);
    expect(moved.body.worker.rateHistory[0].effectiveFrom).toBe(earlier);
    const marked = await a.api.put('/api/v1/attendance', {
      day: addDays(todayIST(), -15),
      records: [{ workerId: w._id, status: 'present' }],
      reason: 'Late entry',
    });
    expect(marked.body.saved).toBe(1);
    const blocked = await a.api.patch(`/api/v1/workers/${w._id}`, {
      joinedOn: addDays(todayIST(), -5),
    });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toBe('This worker has attendance or payments before that date');
    expect(
      (await a.api.patch(`/api/v1/workers/${w._id}`, { joinedOn: addDays(todayIST(), 1) })).status
    ).toBe(400);
  });

  it('deactivate and reactivate', async () => {
    const w = (await newWorker(a.api)).body.worker;
    expect((await a.api.post(`/api/v1/workers/${w._id}/deactivate`)).body.worker.isActive).toBe(
      false
    );
    expect((await a.api.post(`/api/v1/workers/${w._id}/reactivate`)).body.worker.isActive).toBe(
      true
    );
    const actions = (await AuditLog.find({ entity: 'Worker' }).lean()).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['worker.deactivate', 'worker.reactivate']));
  });
});

describe('rate changes', () => {
  const today = todayIST();
  const joined = addDays(today, -30);

  const seedAttendance = (w, rows) =>
    Attendance.insertMany(
      rows.map(([offset, status]) => ({
        contractorId: a.user._id,
        workerId: w._id,
        siteId: siteA._id,
        day: addDays(today, offset),
        status,
        rateSnapshot: 45000,
        earned: status === 'present' ? 45000 : status === 'half-day' ? 22500 : 0,
        markedBy: a.user._id,
      }))
    );

  it('rejects effectiveFrom before the latest entry or in the future', async () => {
    const w = (await newWorker(a.api, { joinedOn: joined, dailyRate: 45000 })).body.worker;
    for (const effectiveFrom of [addDays(joined, -1), addDays(today, 1)]) {
      const res = await a.api.post(`/api/v1/workers/${w._id}/rate`, {
        dailyRate: 50000,
        effectiveFrom,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        `New rate must start on or after ${joined} and not in the future`
      );
    }
  });

  it('a same-day rate change corrects the latest entry and re-prices from it', async () => {
    const w = (await newWorker(a.api, { joinedOn: joined, dailyRate: 45000 })).body.worker;
    await seedAttendance(w, [
      [-30, 'present'],
      [-2, 'half-day'],
    ]);
    const res = await a.api.post(`/api/v1/workers/${w._id}/rate`, {
      dailyRate: 54000,
      effectiveFrom: joined,
    });
    expect(res.status).toBe(200);
    expect(res.body.repricedDays).toBe(2);
    expect(res.body.worker.rateHistory.map((h) => [h.rate, h.effectiveFrom])).toEqual([
      [54000, joined],
    ]);
    const rows = await Attendance.find({ workerId: w._id }).sort({ day: 1 }).lean();
    expect(rows.map((r) => r.earned)).toEqual([54000, 27000]);
  });

  it('a worker added today can have a typo in the rate fixed today', async () => {
    const w = (await newWorker(a.api, { dailyRate: 45000 })).body.worker;
    const res = await a.api.post(`/api/v1/workers/${w._id}/rate`, { dailyRate: 54000 });
    expect(res.status).toBe(200);
    expect(res.body.worker).toMatchObject({ dailyRate: 54000 });
    expect(res.body.worker.rateHistory).toHaveLength(1);
  });

  it('re-prices only days on or after effectiveFrom and reports repricedDays', async () => {
    const w = (await newWorker(a.api, { joinedOn: joined, dailyRate: 45000 })).body.worker;
    await seedAttendance(w, [
      [-10, 'present'],
      [-5, 'half-day'],
      [-2, 'present'],
      [-1, 'absent'],
    ]);
    const res = await a.api.post(`/api/v1/workers/${w._id}/rate`, {
      dailyRate: 50001,
      effectiveFrom: addDays(today, -5),
    });
    expect(res.status).toBe(200);
    expect(res.body.repricedDays).toBe(3);
    expect(res.body.worker.dailyRate).toBe(50001);
    expect(res.body.worker.rateHistory.map((h) => h.rate)).toEqual([45000, 50001]);

    const rows = await Attendance.find({ workerId: w._id }).sort({ day: 1 }).lean();
    expect(rows.map((r) => [r.rateSnapshot, r.earned])).toEqual([
      [45000, 45000],
      [50001, 25000],
      [50001, 50001],
      [50001, 0],
    ]);
    const entry = await AuditLog.findOne({ action: 'worker.rate' }).lean();
    expect(entry.before).toEqual({ dailyRate: 45000 });
    expect(entry.after).toMatchObject({
      dailyRate: 50001,
      effectiveFrom: addDays(today, -5),
      repricedDays: 3,
    });
  });

  it('defaults effectiveFrom to today', async () => {
    const w = (await newWorker(a.api, { joinedOn: joined, dailyRate: 45000 })).body.worker;
    const res = await a.api.post(`/api/v1/workers/${w._id}/rate`, { dailyRate: 47500 });
    expect(res.status).toBe(200);
    expect(res.body.worker.rateHistory[1].effectiveFrom).toBe(today);
    expect(res.body.repricedDays).toBe(0);
  });
});

describe('list', () => {
  beforeEach(async () => {
    await newWorker(a.api, { name: 'Ramesh Yadav' });
    await newWorker(a.api, { name: 'Suresh Patil', role: 'helper', phone: '9123456789' });
    const inactive = (await newWorker(a.api, { name: 'Abdul Karim' })).body.worker;
    await a.api.post(`/api/v1/workers/${inactive._id}/deactivate`);
  });

  it('defaults to active workers sorted by name, paginated', async () => {
    const res = await a.api.get('/api/v1/workers');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 20, total: 2, pages: 1 });
    expect(res.body.data.map((w) => w.name)).toEqual(['Ramesh Yadav', 'Suresh Patil']);
    expect((await a.api.get('/api/v1/workers?status=all')).body.total).toBe(3);
    expect((await a.api.get('/api/v1/workers?status=inactive')).body.data[0].name).toBe(
      'Abdul Karim'
    );
  });

  it('searches name and phone case-insensitively and treats regex literally', async () => {
    expect((await a.api.get('/api/v1/workers?q=ram')).body.data.map((w) => w.name)).toEqual([
      'Ramesh Yadav',
    ]);
    expect((await a.api.get('/api/v1/workers?q=91234')).body.data.map((w) => w.name)).toEqual([
      'Suresh Patil',
    ]);
    expect((await a.api.get('/api/v1/workers?q=.*')).body.total).toBe(0);
  });

  it('filters by role and site, clamps limit', async () => {
    expect((await a.api.get('/api/v1/workers?role=helper')).body.total).toBe(1);
    expect((await a.api.get(`/api/v1/workers?siteId=${siteA._id}`)).body.total).toBe(2);
    expect((await a.api.get('/api/v1/workers?limit=500')).body.limit).toBe(100);
    expect((await a.api.get('/api/v1/workers?siteId=nope')).status).toBe(400);
  });

  it("never shows another contractor's workers", async () => {
    expect((await b.api.get('/api/v1/workers?status=all')).body.total).toBe(0);
  });
});

describe('tenant isolation', () => {
  it("another contractor's worker is 404 everywhere", async () => {
    const w = (await newWorker(a.api)).body.worker;
    expect((await b.api.get(`/api/v1/workers/${w._id}`)).status).toBe(404);
    expect((await b.api.patch(`/api/v1/workers/${w._id}`, { name: 'Hacked Name' })).status).toBe(
      404
    );
    expect((await b.api.post(`/api/v1/workers/${w._id}/rate`, { dailyRate: 90000 })).status).toBe(
      404
    );
    expect((await b.api.post(`/api/v1/workers/${w._id}/deactivate`)).status).toBe(404);
    expect((await b.api.post(`/api/v1/workers/${w._id}/reactivate`)).status).toBe(404);
  });
});
