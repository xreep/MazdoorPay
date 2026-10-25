import { jest } from '@jest/globals';
import { addDays, todayIST } from '@mazdoorpay/shared';
import { useTestDb } from '../helpers/db.js';
import { authed, registerContractor } from '../helpers/factory.js';
import { Attendance } from '../../src/models/Attendance.js';
import { AuditLog } from '../../src/models/AuditLog.js';

useTestDb();

const today = todayIST();
let a;
let b;
let site;
let ramesh;

const worker = async (api, body = {}) =>
  (
    await api.post('/api/v1/workers', {
      name: 'Ramesh Yadav',
      role: 'mason',
      dailyRate: 45001,
      siteId: site._id,
      joinedOn: addDays(today, -30),
      ...body,
    })
  ).body.worker;

const mark = (api, day, records, extra = {}) =>
  api.put('/api/v1/attendance', { day, records, ...extra });

beforeEach(async () => {
  const ra = await registerContractor();
  const rb = await registerContractor();
  a = { ...ra, api: authed(ra.token) };
  b = { ...rb, api: authed(rb.token) };
  site = (await a.api.post('/api/v1/sites', { name: 'Prestige Lakeside' })).body.site;
  ramesh = await worker(a.api);
});

afterEach(() => jest.useRealTimers());

describe('marking', () => {
  it('stores rate snapshot and earnings; half-day floors', async () => {
    const suresh = await worker(a.api, { name: 'Suresh Patil' });
    const res = await mark(a.api, today, [
      { workerId: ramesh._id, status: 'present' },
      { workerId: suresh._id, status: 'half-day' },
    ]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ saved: 2, unchanged: 0, errors: [] });
    const rows = await Attendance.find().lean();
    const byWorker = Object.fromEntries(rows.map((r) => [String(r.workerId), r]));
    expect(byWorker[ramesh._id]).toMatchObject({
      day: today,
      status: 'present',
      rateSnapshot: 45001,
      earned: 45001,
      method: 'manual',
    });
    expect(byWorker[suresh._id]).toMatchObject({
      status: 'half-day',
      rateSnapshot: 45001,
      earned: 22500,
    });
    expect(String(byWorker[ramesh._id].siteId)).toBe(site._id);
  });

  it('re-saving the same status is unchanged and not audited again', async () => {
    await mark(a.api, today, [{ workerId: ramesh._id, status: 'present' }]);
    const again = await mark(a.api, today, [{ workerId: ramesh._id, status: 'present' }]);
    expect(again.body).toEqual({ saved: 0, unchanged: 1, errors: [] });
    expect(await AuditLog.countDocuments({ action: /^attendance\./ })).toBe(1);
  });

  it('changing status updates earnings and writes attendance.update with before/after', async () => {
    await mark(a.api, today, [{ workerId: ramesh._id, status: 'present' }]);
    const res = await mark(a.api, today, [{ workerId: ramesh._id, status: 'absent' }]);
    expect(res.body.saved).toBe(1);
    expect(await Attendance.findOne().lean()).toMatchObject({ status: 'absent', earned: 0 });
    const entry = await AuditLog.findOne({ action: 'attendance.update' }).lean();
    expect(entry.before).toMatchObject({ status: 'present' });
    expect(entry.after).toMatchObject({ status: 'absent', day: today });
    expect(await Attendance.countDocuments()).toBe(1);
    const created = await AuditLog.findOne({ action: 'attendance.create' }).lean();
    const record = await Attendance.findOne().lean();
    expect(String(created.entityId)).toBe(String(record._id));
    expect(String(entry.entityId)).toBe(String(record._id));
  });

  it('uses the IST day for "today" (Review Focus 1)', async () => {
    jest.useFakeTimers({
      now: new Date('2026-10-24T19:00:00Z'),
      doNotFake: [
        'nextTick',
        'setImmediate',
        'setTimeout',
        'setInterval',
        'clearTimeout',
        'clearInterval',
        'clearImmediate',
        'queueMicrotask',
      ],
    });
    const early = await worker(a.api, { name: 'Early Joiner', joinedOn: '2026-10-01' });
    expect(
      (await mark(a.api, '2026-10-25', [{ workerId: early._id, status: 'present' }])).body.saved
    ).toBe(1);
    const future = await mark(a.api, '2026-10-26', [{ workerId: early._id, status: 'present' }]);
    expect(future.status).toBe(400);
    expect(future.body.error).toBe('Attendance cannot be marked for a future day');
  });

  it('rejects impossible days (Review Focus 2)', async () => {
    for (const day of ['2026-02-30', '2026-13-01', '24-10-2026', '2026-10-5']) {
      expect((await mark(a.api, day, [{ workerId: ramesh._id, status: 'present' }])).status).toBe(
        400
      );
    }
  });

  it('needs a reason for days more than 7 days back', async () => {
    const seven = await mark(a.api, addDays(today, -7), [
      { workerId: ramesh._id, status: 'present' },
    ]);
    expect(seven.body.saved).toBe(1);
    const eight = await mark(a.api, addDays(today, -8), [
      { workerId: ramesh._id, status: 'present' },
    ]);
    expect(eight.status).toBe(400);
    expect(eight.body.error).toBe('Please give a reason for changing attendance older than 7 days');
    const withReason = await mark(
      a.api,
      addDays(today, -8),
      [{ workerId: ramesh._id, status: 'present' }],
      { reason: 'Register entry copied late' }
    );
    expect(withReason.body.saved).toBe(1);
    const entry = await AuditLog.findOne({
      action: 'attendance.create',
      'after.day': addDays(today, -8),
    }).lean();
    expect(entry.after.reason).toBe('Register entry copied late');
  });

  it('reports per-record errors while saving valid ones', async () => {
    const inactive = await worker(a.api, { name: 'Gone Worker' });
    await a.api.post(`/api/v1/workers/${inactive._id}/deactivate`);
    const late = await worker(a.api, { name: 'New Joiner', joinedOn: today });
    const noSite = await worker(a.api, { name: 'No Site', siteId: undefined });
    const foreign = await worker(b.api, { name: 'Other Contractor', siteId: undefined });
    const day = addDays(today, -1);
    const res = await mark(a.api, day, [
      { workerId: ramesh._id, status: 'present' },
      { workerId: inactive._id, status: 'present' },
      { workerId: late._id, status: 'present' },
      { workerId: noSite._id, status: 'present' },
      { workerId: foreign._id, status: 'present' },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(1);
    expect(res.body.errors).toEqual([
      { workerId: inactive._id, error: 'Worker is inactive' },
      { workerId: late._id, error: 'Worker had not joined on this day' },
      { workerId: noSite._id, error: 'Assign this worker to a site first' },
      { workerId: foreign._id, error: 'Worker not found' },
    ]);
    expect(await Attendance.countDocuments({ workerId: foreign._id })).toBe(0);
  });

  it('rejects duplicate workers, empty lists and bad statuses', async () => {
    const dup = await mark(a.api, today, [
      { workerId: ramesh._id, status: 'present' },
      { workerId: ramesh._id, status: 'absent' },
    ]);
    expect(dup.status).toBe(400);
    expect((await mark(a.api, today, [])).status).toBe(400);
    expect((await mark(a.api, today, [{ workerId: ramesh._id, status: 'late' }])).status).toBe(400);
  });

  it('re-marking an old day after a raise keeps the old rate', async () => {
    const day = addDays(today, -6);
    await mark(a.api, day, [{ workerId: ramesh._id, status: 'present' }]);
    await a.api.post(`/api/v1/workers/${ramesh._id}/rate`, { dailyRate: 50000 });
    await mark(a.api, day, [{ workerId: ramesh._id, status: 'half-day' }]);
    expect(await Attendance.findOne({ day }).lean()).toMatchObject({
      rateSnapshot: 45001,
      earned: 22500,
    });
    await mark(a.api, today, [{ workerId: ramesh._id, status: 'present' }]);
    expect(await Attendance.findOne({ day: today }).lean()).toMatchObject({
      rateSnapshot: 50000,
      earned: 50000,
    });
  });
});

describe('reading', () => {
  it('sheet lists the site workers with statuses and summary', async () => {
    const suresh = await worker(a.api, { name: 'Suresh Patil', role: 'helper' });
    await worker(a.api, { name: 'Zakir Hussain' });
    await mark(a.api, today, [
      { workerId: ramesh._id, status: 'present' },
      { workerId: suresh._id, status: 'half-day' },
    ]);
    const res = await a.api.get(`/api/v1/attendance/sheet?siteId=${site._id}&day=${today}`);
    expect(res.status).toBe(200);
    expect(res.body.day).toBe(today);
    expect(res.body.site.name).toBe('Prestige Lakeside');
    expect(res.body.workers.map((w) => [w.name, w.status])).toEqual([
      ['Ramesh Yadav', 'present'],
      ['Suresh Patil', 'half-day'],
      ['Zakir Hussain', null],
    ]);
    expect(res.body.workers[0]).toMatchObject({
      workerId: ramesh._id,
      role: 'mason',
      rate: 45001,
      method: 'manual',
      isActive: true,
    });
    expect(res.body.summary).toEqual({ total: 3, marked: 2, present: 1, halfDay: 1, absent: 0 });
  });

  it('sheet defaults to today and keeps a since-deactivated worker who was marked', async () => {
    await mark(a.api, today, [{ workerId: ramesh._id, status: 'present' }]);
    await a.api.post(`/api/v1/workers/${ramesh._id}/deactivate`);
    const res = await a.api.get(`/api/v1/attendance/sheet?siteId=${site._id}`);
    expect(res.body.day).toBe(today);
    expect(res.body.workers).toEqual([
      expect.objectContaining({ name: 'Ramesh Yadav', status: 'present', isActive: false }),
    ]);
  });

  it('list filters by worker and range, newest first', async () => {
    for (const offset of [-3, -2, -1])
      await mark(a.api, addDays(today, offset), [{ workerId: ramesh._id, status: 'present' }]);
    const res = await a.api.get(
      `/api/v1/attendance?workerId=${ramesh._id}&from=${addDays(today, -2)}&to=${today}`
    );
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.map((r) => r.day)).toEqual([addDays(today, -1), addDays(today, -2)]);
    expect(res.body.data[0].worker).toMatchObject({ name: 'Ramesh Yadav' });
    expect(
      (await a.api.get(`/api/v1/attendance?from=${today}&to=${addDays(today, -1)}`)).status
    ).toBe(400);
  });

  it('calendar counts per day for a month', async () => {
    const suresh = await worker(a.api, { name: 'Suresh Patil' });
    const month = today.slice(0, 7);
    await mark(a.api, today, [
      { workerId: ramesh._id, status: 'present' },
      { workerId: suresh._id, status: 'absent' },
    ]);
    const res = await a.api.get(`/api/v1/attendance/calendar?siteId=${site._id}&month=${month}`);
    expect(res.status).toBe(200);
    expect(res.body.month).toBe(month);
    const entry = res.body.days.find((d) => d.day === today);
    expect(entry).toEqual({ day: today, present: 1, halfDay: 0, absent: 1, marked: 2 });
    expect(res.body.days[0]).toMatchObject({ day: `${month}-01` });
    expect((await a.api.get(`/api/v1/attendance/calendar?month=2026-13`)).status).toBe(400);
  });

  it("another contractor cannot read A's attendance", async () => {
    await mark(a.api, today, [{ workerId: ramesh._id, status: 'present' }]);
    expect((await b.api.get(`/api/v1/attendance/sheet?siteId=${site._id}`)).status).toBe(404);
    expect(
      (await b.api.get(`/api/v1/attendance/calendar?siteId=${site._id}&month=${today.slice(0, 7)}`))
        .status
    ).toBe(404);
    expect((await b.api.get(`/api/v1/attendance?workerId=${ramesh._id}`)).body.total).toBe(0);
    expect((await b.api.get('/api/v1/attendance')).body.total).toBe(0);
  });
});
