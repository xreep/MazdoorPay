import { Attendance } from '../../src/models/Attendance.js';
import { useTestDb } from '../helpers/db.js';
import { authed, registerContractor } from '../helpers/factory.js';
import { ledgerFixture } from '../helpers/ledgerFixture.js';

useTestDb();

let fx;
beforeEach(async () => {
  fx = await ledgerFixture();
});

const get = (path) => fx.api.get(`/api/v1/reports/${path}`);
const csvLines = (res) => res.text.replace(/^\uFEFF/, '').split('\r\n');

describe('attendance report', () => {
  it('lists rows in the range, JSON and CSV', async () => {
    const json = await get('attendance?from=2026-10-15&to=2026-10-19');
    expect(json.status).toBe(200);
    expect(json.body.rows).toHaveLength(4);
    expect(json.body.rows[0]).toEqual({
      day: '2026-10-15',
      worker: 'Ramesh Yadav',
      role: 'mason',
      site: 'Prestige Lakeside',
      status: 'present',
      rate: 45000,
      earned: 45000,
    });

    const csv = await get('attendance?from=2026-10-15&to=2026-10-19&format=csv');
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(csv.headers['content-disposition']).toBe(
      'attachment; filename="attendance-2026-10-15-to-2026-10-19.csv"'
    );
    const lines = csvLines(csv);
    expect(lines[0]).toBe('Date,Worker,Role,Site,Status,Rate (₹),Earned (₹)');
    expect(lines[1]).toBe('2026-10-15,Ramesh Yadav,mason,Prestige Lakeside,Present,450.00,450.00');
    expect(lines).toContain(
      '2026-10-17,Ramesh Yadav,mason,Prestige Lakeside,Half day,450.00,225.00'
    );
  });
});

describe('muster roll', () => {
  it('has one column per day of the month and P/H/A marks', async () => {
    const w = (
      await fx.api.post('/api/v1/workers', {
        name: 'Abdul Karim',
        role: 'carpenter',
        dailyRate: 70000,
        siteId: fx.s1._id,
        joinedOn: '2026-02-01',
      })
    ).body.worker;
    const row = (day, status, earned) => ({
      contractorId: fx.user._id,
      workerId: w._id,
      siteId: fx.s1._id,
      day,
      status,
      rateSnapshot: 70000,
      earned,
      markedBy: fx.user._id,
    });
    await Attendance.insertMany([
      row('2026-02-02', 'present', 70000),
      row('2026-02-03', 'half-day', 35000),
      row('2026-02-28', 'absent', 0),
    ]);

    const json = await get(`muster-roll?month=2026-02&siteId=${fx.s1._id}`);
    expect(json.status).toBe(200);
    expect(json.body.days).toHaveLength(28);
    expect(json.body.site.name).toBe('Prestige Lakeside');
    const abdul = json.body.rows.find((r) => r.name === 'Abdul Karim');
    expect(abdul).toMatchObject({
      role: 'carpenter',
      present: 1,
      halfDay: 1,
      absent: 1,
      earned: 105000,
    });
    expect(abdul.marks).toEqual({ '2026-02-02': 'P', '2026-02-03': 'H', '2026-02-28': 'A' });

    const csv = await get(`muster-roll?month=2026-02&siteId=${fx.s1._id}&format=csv`);
    expect(csv.headers['content-disposition']).toBe(
      'attachment; filename="muster-roll-2026-02-prestige-lakeside.csv"'
    );
    const [header, ...rest] = csvLines(csv);
    const cols = header.split(',');
    expect(cols).toHaveLength(2 + 28 + 4);
    expect(cols.slice(0, 3)).toEqual(['Name', 'Role', '1']);
    expect(cols.slice(-4)).toEqual(['Present', 'Half days', 'Absent', 'Earned (₹)']);
    const abdulLine = rest.find((l) => l.startsWith('Abdul Karim')).split(',');
    expect(abdulLine.slice(2, 5)).toEqual(['', 'P', 'H']);
    expect(abdulLine.at(-1)).toBe('1050.00');
  });

  it('requires a site and a valid month', async () => {
    expect((await get('muster-roll?month=2026-02')).status).toBe(400);
    expect((await get(`muster-roll?month=2026-14&siteId=${fx.s1._id}`)).status).toBe(400);
  });
});

describe('wage register', () => {
  it('gross equals the wage summary for the same range', async () => {
    const reg = await get('wage-register?from=2026-10-15&to=2026-10-28');
    const sum = await fx.api.get('/api/v1/wages/summary?from=2026-10-15&to=2026-10-28');
    expect(reg.status).toBe(200);
    const gross = reg.body.rows.reduce((s, r) => s + r.gross, 0);
    expect(gross).toBe(sum.body.totals.earned);
    const ramesh = reg.body.rows.find((r) => r.name === 'Ramesh Yadav');
    expect(ramesh).toMatchObject({
      role: 'mason',
      site: 'Prestige Lakeside',
      present: 3,
      halfDay: 2,
      absent: 1,
      rates: '₹450 / ₹500',
      gross: 192500,
      wagesPaid: 30000,
      advancesPaid: 0,
      balance: 197500,
    });
    const csv = await get('wage-register?from=2026-10-15&to=2026-10-28&format=csv');
    expect(csvLines(csv)[0]).toBe(
      'Name,Role,Site,Present,Half days,Absent,Rates,Gross (₹),Advances paid (₹),Wages paid (₹),Balance (₹)'
    );
  });
});

describe('payments report', () => {
  it('marks voided rows only when asked', async () => {
    const plain = await get('payments?from=2026-10-01&to=2026-10-31');
    expect(plain.body.rows.map((r) => r.status)).toEqual(['Paid', 'Paid']);
    const all = await get('payments?from=2026-10-01&to=2026-10-31&includeVoided=true');
    expect(all.body.rows.map((r) => [r.day, r.status])).toEqual([
      ['2026-10-20', 'Paid'],
      ['2026-10-21', 'Void'],
      ['2026-10-29', 'Paid'],
    ]);
    expect(all.body.rows[0]).toMatchObject({
      worker: 'Ramesh Yadav',
      type: 'wage',
      method: 'cash',
      amount: 30000,
    });
    const csv = await get('payments?from=2026-10-01&to=2026-10-31&format=csv');
    expect(csv.headers['content-disposition']).toBe(
      'attachment; filename="payments-2026-10-01-to-2026-10-31.csv"'
    );
    expect(csvLines(csv)[1]).toBe('2026-10-20,Ramesh Yadav,Wage,Cash,,300.00,Paid,');
  });
});

describe('isolation', () => {
  it("another contractor's site is 404 and their data is invisible", async () => {
    const other = authed((await registerContractor()).token);
    expect(
      (await other.get(`/api/v1/reports/muster-roll?month=2026-10&siteId=${fx.s1._id}`)).status
    ).toBe(404);
    expect(
      (
        await other.get(
          `/api/v1/reports/attendance?from=2026-10-01&to=2026-10-31&siteId=${fx.s1._id}`
        )
      ).status
    ).toBe(404);
    expect(
      (await other.get('/api/v1/reports/attendance?from=2026-10-01&to=2026-10-31')).body.rows
    ).toEqual([]);
    expect(
      (await other.get('/api/v1/reports/payments?from=2026-10-01&to=2026-10-31')).body.rows
    ).toEqual([]);
  });
});
