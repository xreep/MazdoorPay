import { jest } from '@jest/globals';
import { useTestDb } from '../helpers/db.js';
import { ledgerFixture } from '../helpers/ledgerFixture.js';

useTestDb();

const fakeNow = (iso) =>
  jest.useFakeTimers({
    now: new Date(iso),
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

afterEach(() => jest.useRealTimers());

it("dashboard shows today's attendance per site, money and a 30-day trend", async () => {
  const fx = await ledgerFixture();
  fakeNow('2026-10-24T19:00:00Z'); // already 25 Oct in India
  const res = await fx.api.get('/api/v1/dashboard');
  expect(res.status).toBe(200);
  expect(res.body.today).toBe('2026-10-25');
  expect(res.body.sites).toEqual([
    {
      siteId: fx.s1._id,
      name: 'Prestige Lakeside',
      activeWorkers: 1,
      marked: 1,
      present: 1,
      halfDay: 0,
      absent: 0,
    },
    {
      siteId: fx.s2._id,
      name: 'Sobha Tower',
      activeWorkers: 1,
      marked: 1,
      present: 0,
      halfDay: 0,
      absent: 1,
    },
  ]);
  const dues = (await fx.api.get('/api/v1/payments/dues')).body.totals;
  expect(res.body.money).toEqual({
    pendingDues: dues.pending,
    advanceOutstanding: dues.advance,
    workersWithDues: dues.workersWithDues,
    paidThisWeek: 30000,
  });
  expect(res.body.trend).toHaveLength(30);
  expect(res.body.trend.at(-1)).toEqual({
    day: '2026-10-25',
    present: 1,
    halfDay: 0,
    absent: 1,
    earned: 50000,
  });
  expect(res.body.trend[0].day).toBe('2026-09-26');
  expect(res.body.counts).toEqual({ activeSites: 2, activeWorkers: 2 });
});

it('dashboard for a brand-new contractor is all zeros', async () => {
  const { registerContractor, authed } = await import('../helpers/factory.js');
  const reg = await registerContractor();
  const res = await authed(reg.token).get('/api/v1/dashboard');
  expect(res.status).toBe(200);
  expect(res.body.sites).toEqual([]);
  expect(res.body.money).toEqual({
    pendingDues: 0,
    advanceOutstanding: 0,
    workersWithDues: 0,
    paidThisWeek: 0,
  });
  expect(res.body.trend.every((d) => d.present === 0 && d.earned === 0)).toBe(true);
});
