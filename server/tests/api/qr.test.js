import { todayIST } from '@mazdoorpay/shared';
import { useTestDb } from '../helpers/db.js';
import { authed, registerContractor } from '../helpers/factory.js';
import { Attendance } from '../../src/models/Attendance.js';
import { AuditLog } from '../../src/models/AuditLog.js';
import { readWorkerCode } from '../../src/services/qr.service.js';

useTestDb();

let a;
let b;
let site;
let other;
beforeEach(async () => {
  const ra = await registerContractor({ name: 'Ravi Kumar' });
  a = { ...ra, api: authed(ra.token) };
  const rb = await registerContractor();
  b = { ...rb, api: authed(rb.token) };
  site = (await a.api.post('/api/v1/sites', { name: 'Prestige Lakeside' })).body.site;
  other = (await a.api.post('/api/v1/sites', { name: 'Sobha Tower' })).body.site;
});

const newWorker = async (api, body = {}) =>
  (
    await api.post('/api/v1/workers', {
      name: 'Ramesh Yadav',
      role: 'mason',
      dailyRate: 80000,
      siteId: site._id,
      ...body,
    })
  ).body.worker;

const cardOf = async (workerId) =>
  (await a.api.get(`/api/v1/workers/cards?workerId=${workerId}`)).body.cards[0].code;

describe('ID cards', () => {
  it('prints a signed card for each active worker on a site', async () => {
    const ramesh = await newWorker(a.api);
    const suresh = await newWorker(a.api, { name: 'Suresh Patil' });
    await newWorker(a.api, { name: 'Elsewhere', siteId: other._id });
    await a.api.post(`/api/v1/workers/${suresh._id}/deactivate`);

    const res = await a.api.get(`/api/v1/workers/cards?siteId=${site._id}`);
    expect(res.status).toBe(200);
    expect(res.body.contractor).toMatchObject({ name: 'Ravi Kumar' });
    expect(res.body.cards).toHaveLength(1);
    const [card] = res.body.cards;
    expect(card.worker).toMatchObject({ _id: ramesh._id, name: 'Ramesh Yadav', role: 'mason' });
    expect(card.site).toMatchObject({ name: 'Prestige Lakeside' });
    expect(readWorkerCode(card.code)).toEqual({ workerId: ramesh._id, version: 1 });
  });

  it("never prints another contractor's workers", async () => {
    const ramesh = await newWorker(a.api);
    expect((await b.api.get(`/api/v1/workers/cards?workerId=${ramesh._id}`)).status).toBe(404);
    expect((await b.api.get(`/api/v1/workers/cards?siteId=${site._id}`)).status).toBe(404);
  });

  it('a replaced card stops working and the new one works', async () => {
    const ramesh = await newWorker(a.api);
    const old = await cardOf(ramesh._id);
    const res = await a.api.post(`/api/v1/workers/${ramesh._id}/card/replace`);
    expect(res.status).toBe(200);
    expect(readWorkerCode(res.body.code)).toEqual({ workerId: ramesh._id, version: 2 });
    expect(await AuditLog.countDocuments({ action: 'worker.card_replace' })).toBe(1);

    const stale = await a.api.post('/api/v1/attendance/scan', { code: old });
    expect(stale.status).toBe(400);
    expect(stale.body.error).toMatch(/replaced/);
    expect((await a.api.post('/api/v1/attendance/scan', { code: res.body.code })).status).toBe(200);
  });
});

describe('POST /attendance/scan', () => {
  it('marks the worker present today, by QR, once', async () => {
    const ramesh = await newWorker(a.api);
    const code = await cardOf(ramesh._id);
    const first = await a.api.post('/api/v1/attendance/scan', { code });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      result: 'marked',
      status: 'present',
      worker: { _id: ramesh._id, name: 'Ramesh Yadav' },
    });
    const mark = await Attendance.findOne({ workerId: ramesh._id, day: todayIST() }).lean();
    expect(mark).toMatchObject({ status: 'present', method: 'qr', earned: 80000 });

    const again = await a.api.post('/api/v1/attendance/scan', { code });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ result: 'already', status: 'present' });
    expect(await Attendance.countDocuments()).toBe(1);
  });

  it('leaves an earlier mark for today alone and says what it was', async () => {
    const ramesh = await newWorker(a.api);
    await a.api.put('/api/v1/attendance', {
      day: todayIST(),
      records: [{ workerId: ramesh._id, status: 'half-day' }],
    });
    const res = await a.api.post('/api/v1/attendance/scan', { code: await cardOf(ramesh._id) });
    expect(res.body).toMatchObject({ result: 'already', status: 'half-day' });
  });

  it("rejects another contractor's card, a forged card and an inactive worker", async () => {
    const ramesh = await newWorker(a.api);
    const code = await cardOf(ramesh._id);

    const foreign = await b.api.post('/api/v1/attendance/scan', { code });
    expect(foreign.status).toBe(404);
    expect(foreign.body.error).toMatch(/not one of your workers/);

    const forged = await a.api.post('/api/v1/attendance/scan', {
      code: `${code.slice(0, -1)}${code.endsWith('x') ? 'y' : 'x'}`,
    });
    expect(forged.status).toBe(400);
    expect(forged.body.error).toMatch(/not a MazdoorPay worker card/);

    await a.api.post(`/api/v1/workers/${ramesh._id}/deactivate`);
    const inactive = await a.api.post('/api/v1/attendance/scan', { code });
    expect(inactive.status).toBe(400);
    expect(inactive.body.error).toMatch(/inactive/);
    expect(await Attendance.countDocuments()).toBe(0);
  });
});
