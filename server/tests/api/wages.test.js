import { useTestDb } from '../helpers/db.js';
import { authed, registerContractor } from '../helpers/factory.js';
import { ledgerFixture } from '../helpers/ledgerFixture.js';

useTestDb();

let fx;
beforeEach(async () => {
  fx = await ledgerFixture();
});

const summary = (query) => fx.api.get(`/api/v1/wages/summary?${query}`);

describe('wage summary', () => {
  it('weekly buckets are clipped to the range and counted from stored earnings', async () => {
    const res = await summary('from=2026-10-15&to=2026-10-28&groupBy=week');
    expect(res.status).toBe(200);
    expect(res.body.groupBy).toBe('week');
    expect(res.body.buckets).toEqual([
      { start: '2026-10-15', end: '2026-10-18', present: 1, halfDay: 1, absent: 1, earned: 67500 },
      { start: '2026-10-19', end: '2026-10-25', present: 3, halfDay: 0, absent: 1, earned: 160000 },
      { start: '2026-10-26', end: '2026-10-28', present: 0, halfDay: 1, absent: 0, earned: 25000 },
    ]);
  });

  it('per-worker rows carry period pay and all-time balance', async () => {
    const res = await summary('from=2026-10-15&to=2026-10-28');
    const ramesh = res.body.workers.find((w) => w.name === 'Ramesh Yadav');
    expect(ramesh).toMatchObject({
      workerId: fx.w1._id,
      role: 'mason',
      siteId: fx.s1._id,
      present: 3,
      halfDay: 2,
      absent: 1,
      earned: 192500,
      paidInPeriod: 30000,
      balance: 197500,
    });
    expect(ramesh.buckets.map((b) => b.earned)).toEqual([67500, 100000, 25000]);
    const totals = res.body.workers.reduce(
      (t, w) => ({
        present: t.present + w.present,
        earned: t.earned + w.earned,
        paidInPeriod: t.paidInPeriod + w.paidInPeriod,
        balance: t.balance + w.balance,
      }),
      { present: 0, earned: 0, paidInPeriod: 0, balance: 0 }
    );
    expect(res.body.totals).toMatchObject(totals);
    expect(res.body.totals).toEqual({
      present: 4,
      halfDay: 2,
      absent: 2,
      earned: 252500,
      paidInPeriod: 30000,
      wagesPaidInPeriod: 30000,
      advancesInPeriod: 0,
      balance: 257500,
    });
  });

  it('splits what was paid in the period into wages and advances', async () => {
    const res = await summary('from=2026-10-15&to=2026-10-31');
    const ramesh = res.body.workers.find((w) => w.name === 'Ramesh Yadav');
    // The voided ₹50 on 21 Oct is not counted; the ₹100 advance on 29 Oct is.
    expect(ramesh).toMatchObject({
      paidInPeriod: 40000,
      wagesPaidInPeriod: 30000,
      advancesInPeriod: 10000,
    });
    expect(res.body.totals).toMatchObject({ wagesPaidInPeriod: 30000, advancesInPeriod: 10000 });
  });

  it('daily grouping returns one bucket per day', async () => {
    const res = await summary('from=2026-10-15&to=2026-10-28&groupBy=day');
    expect(res.body.buckets).toHaveLength(14);
    expect(res.body.buckets[0]).toEqual({
      start: '2026-10-15',
      end: '2026-10-15',
      present: 1,
      halfDay: 0,
      absent: 0,
      earned: 45000,
    });
    expect(res.body.buckets[1].earned).toBe(0);
  });

  it('site and worker filters', async () => {
    const site = await summary(`from=2026-10-15&to=2026-10-28&siteId=${fx.s1._id}`);
    expect(site.body.workers.map((w) => w.name)).toEqual(['Ramesh Yadav']);
    expect(site.body.totals.earned).toBe(192500);
    const worker = await summary(`from=2026-10-15&to=2026-10-28&workerId=${fx.w2._id}`);
    expect(worker.body.totals.earned).toBe(60000);
  });

  it('validates the range', async () => {
    expect((await summary('from=2026-10-28&to=2026-10-15')).status).toBe(400);
    expect((await summary('from=2025-01-01&to=2026-10-15')).status).toBe(400);
    expect((await summary('from=2026-10-01')).status).toBe(400);
    expect((await summary('from=2026-10-01&to=2026-10-02&groupBy=month')).status).toBe(400);
  });

  it("another contractor sees nothing of A's", async () => {
    const other = await registerContractor();
    const res = await authed(other.token).get(
      '/api/v1/wages/summary?from=2026-10-15&to=2026-10-28'
    );
    expect(res.body.workers).toEqual([]);
    expect(res.body.totals.earned).toBe(0);
    expect(
      (
        await authed(other.token).get(
          `/api/v1/wages/summary?from=2026-10-15&to=2026-10-28&siteId=${fx.s1._id}`
        )
      ).status
    ).toBe(404);
  });
});
