import { useTestDb } from '../helpers/db.js';
import { authed, registerContractor } from '../helpers/factory.js';
import { ledgerFixture } from '../helpers/ledgerFixture.js';

useTestDb();

describe('GET /workers/:id/slip', () => {
  it("adds up one worker's period from the previous balance to the closing balance", async () => {
    const fx = await ledgerFixture();
    const res = await fx.api.get(`/api/v1/workers/${fx.w1._id}/slip?from=2026-10-19&to=2026-10-25`);
    expect(res.status).toBe(200);
    expect(res.body.worker).toMatchObject({ name: 'Ramesh Yadav', role: 'mason' });
    expect(res.body.site).toMatchObject({ name: 'Prestige Lakeside' });
    expect(res.body.contractor).toMatchObject({ name: 'Ravi Kumar' });
    expect(res.body.days).toEqual([
      { day: '2026-10-19', status: 'present', rate: 50000, earned: 50000 },
      { day: '2026-10-25', status: 'present', rate: 50000, earned: 50000 },
    ]);
    // The voided payment on 21 Oct is left out; the advance on 29 Oct is after the period.
    expect(res.body.payments.map((p) => [p.day, p.amount, p.type])).toEqual([
      ['2026-10-20', 30000, 'wage'],
    ]);
    expect(res.body.totals).toEqual({
      present: 2,
      halfDay: 0,
      absent: 0,
      earned: 100000,
      wagesPaid: 30000,
      advancesPaid: 0,
    });
    expect(res.body.openingBalance).toBe(112500);
    expect(res.body.closingBalance).toBe(182500);
  });

  it("ends at the worker's current balance when the period runs to the last record", async () => {
    const fx = await ledgerFixture();
    const slip = await fx.api.get(
      `/api/v1/workers/${fx.w1._id}/slip?from=2026-10-01&to=2026-10-31`
    );
    const summary = await fx.api.get(`/api/v1/workers/${fx.w1._id}/summary`);
    expect(slip.body.openingBalance).toBe(0);
    expect(slip.body.closingBalance).toBe(summary.body.balance.balance);
  });

  it("is 404 for another contractor's worker and 400 for a backwards period", async () => {
    const fx = await ledgerFixture();
    const other = authed((await registerContractor()).token);
    expect(
      (await other.get(`/api/v1/workers/${fx.w1._id}/slip?from=2026-10-19&to=2026-10-25`)).status
    ).toBe(404);
    expect(
      (await fx.api.get(`/api/v1/workers/${fx.w1._id}/slip?from=2026-10-25&to=2026-10-19`)).status
    ).toBe(400);
  });
});
