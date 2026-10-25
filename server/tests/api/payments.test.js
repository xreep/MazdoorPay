import crypto from 'node:crypto';
import { addDays, todayIST } from '@mazdoorpay/shared';
import { useTestDb } from '../helpers/db.js';
import { authed, registerContractor } from '../helpers/factory.js';
import { Payment } from '../../src/models/Payment.js';
import { AuditLog } from '../../src/models/AuditLog.js';

useTestDb();

const today = todayIST();
let a;
let b;
let site;
let ramesh;

const createWorker = async (api, body = {}) =>
  (
    await api.post('/api/v1/workers', {
      name: 'Ramesh Yadav',
      role: 'mason',
      dailyRate: 50000,
      siteId: site?._id,
      joinedOn: addDays(today, -30),
      ...body,
    })
  ).body.worker;

const markDays = (api, worker, offsets, status = 'present') =>
  Promise.all(
    offsets.map((o) =>
      api.put('/api/v1/attendance', {
        day: addDays(today, o),
        records: [{ workerId: worker._id, status }],
      })
    )
  );

const pay = (api, body = {}) =>
  api.post('/api/v1/payments', {
    workerId: ramesh._id,
    amount: 100000,
    type: 'wage',
    method: 'cash',
    idempotencyKey: crypto.randomUUID(),
    ...body,
  });

beforeEach(async () => {
  const ra = await registerContractor({ name: 'Ravi Kumar', phone: '9800000001' });
  const rb = await registerContractor();
  a = { ...ra, api: authed(ra.token) };
  b = { ...rb, api: authed(rb.token) };
  site = (await a.api.post('/api/v1/sites', { name: 'Prestige Lakeside' })).body.site;
  ramesh = await createWorker(a.api);
  await markDays(a.api, ramesh, [-4, -3, -2, -1]); // earned ₹2,000
});

describe('recording payments', () => {
  it('wage payment within dues succeeds and returns the new balance', async () => {
    const res = await pay(a.api, { amount: 150000 });
    expect(res.status).toBe(201);
    expect(res.body.payment).toMatchObject({
      amount: 150000,
      type: 'wage',
      method: 'cash',
      day: today,
      siteId: site._id,
    });
    expect(res.body.balance).toEqual({
      earned: 200000,
      paidWage: 150000,
      paidAdvance: 0,
      paid: 150000,
      balance: 50000,
    });
    const entry = await AuditLog.findOne({ action: 'payment.create' }).lean();
    expect(entry.after).toMatchObject({ amount: 150000, type: 'wage' });
  });

  it('wage payment above dues is refused with the dues amount', async () => {
    const res = await pay(a.api, { amount: 200001 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      'Amount is more than pending dues (₹2,000). Record the extra as an advance.'
    );
    expect(await Payment.countDocuments()).toBe(0);
  });

  it('advance with no dues makes the balance negative; later work pays it back', async () => {
    await pay(a.api, { amount: 200000 });
    const adv = await pay(a.api, { amount: 75000, type: 'advance' });
    expect(adv.status).toBe(201);
    expect(adv.body.balance.balance).toBe(-75000);
    expect((await pay(a.api, { amount: 100 })).status).toBe(400);
    await markDays(a.api, ramesh, [0]);
    const summary = await a.api.get(`/api/v1/workers/${ramesh._id}/summary`);
    expect(summary.body.balance.balance).toBe(-25000);
  });

  it('UPI needs a 12-digit UTR, bank reference is optional, cash has none', async () => {
    expect((await pay(a.api, { method: 'upi', amount: 100 })).status).toBe(400);
    expect(
      (await pay(a.api, { method: 'upi', amount: 100, reference: '12345678901' })).status
    ).toBe(400);
    expect(
      (await pay(a.api, { method: 'upi', amount: 100, reference: '412345678901' })).status
    ).toBe(201);
    expect((await pay(a.api, { method: 'bank', amount: 100 })).status).toBe(201);
    expect((await pay(a.api, { method: 'bank', amount: 100, reference: 'NEFT-AB12' })).status).toBe(
      201
    );
    expect((await pay(a.api, { method: 'bank', amount: 100, reference: 'bad ref!' })).status).toBe(
      400
    );
    expect(
      (await pay(a.api, { method: 'cash', amount: 100, reference: '412345678901' })).status
    ).toBe(400);
  });

  it('validates amount, day and idempotency key', async () => {
    expect((await pay(a.api, { amount: 0 })).status).toBe(400);
    expect((await pay(a.api, { amount: 50000001, type: 'advance' })).status).toBe(400);
    expect((await pay(a.api, { amount: 10.5 })).status).toBe(400);
    expect((await pay(a.api, { idempotencyKey: 'abc' })).status).toBe(400);
    expect((await pay(a.api, { amount: 100, day: addDays(today, 1) })).status).toBe(400);
    const beforeJoin = await pay(a.api, { amount: 100, type: 'advance', day: addDays(today, -31) });
    expect(beforeJoin.status).toBe(400);
    expect(beforeJoin.body.error).toBe('Payment date is before the worker joined');
    expect((await pay(a.api, { amount: 100, day: addDays(today, -2) })).body.payment.day).toBe(
      addDays(today, -2)
    );
  });

  it('same idempotencyKey twice returns the first payment (Review Focus 4)', async () => {
    const key = crypto.randomUUID();
    const first = await pay(a.api, { amount: 50000, idempotencyKey: key });
    const second = await pay(a.api, { amount: 50000, idempotencyKey: key });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.payment._id).toBe(first.body.payment._id);
    expect(await Payment.countDocuments()).toBe(1);
    const reused = await pay(a.api, { amount: 60000, idempotencyKey: key });
    expect(reused.status).toBe(409);
  });

  it('same key sent twice at once still creates one payment', async () => {
    const key = crypto.randomUUID();
    const results = await Promise.all([
      pay(a.api, { amount: 50000, idempotencyKey: key }),
      pay(a.api, { amount: 50000, idempotencyKey: key }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(await Payment.countDocuments()).toBe(1);
  });

  it('two racing wage payments for the full dues: exactly one succeeds (Review Focus 4)', async () => {
    const results = await Promise.all([
      pay(a.api, { amount: 200000 }),
      pay(a.api, { amount: 200000 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(await Payment.countDocuments()).toBe(1);
  });
});

describe('voids', () => {
  it('void excludes the payment from the balance; second void is 409', async () => {
    const p = (await pay(a.api, { amount: 150000 })).body.payment;
    const res = await a.api.post(`/api/v1/payments/${p._id}/void`, {
      reason: 'Entered ₹1,500 instead of ₹150',
    });
    expect(res.status).toBe(200);
    expect(res.body.payment.voidedAt).toEqual(expect.any(String));
    expect(res.body.payment.voidReason).toBe('Entered ₹1,500 instead of ₹150');
    expect(res.body.balance.balance).toBe(200000);
    const again = await a.api.post(`/api/v1/payments/${p._id}/void`, { reason: 'again' });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('This payment is already void');
    expect((await a.api.post(`/api/v1/payments/${p._id}/void`, { reason: 'x' })).status).toBe(400);
    expect(await AuditLog.countDocuments({ action: 'payment.void' })).toBe(1);
  });
});

describe('reading', () => {
  it('list filters and hides voided payments unless asked', async () => {
    const p1 = (await pay(a.api, { amount: 50000 })).body.payment;
    await pay(a.api, { amount: 20000, method: 'upi', reference: '412345678901' });
    await a.api.post(`/api/v1/payments/${p1._id}/void`, { reason: 'Duplicate entry' });
    const list = await a.api.get('/api/v1/payments');
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.data[0]).toMatchObject({ method: 'upi', worker: { name: 'Ramesh Yadav' } });
    expect((await a.api.get('/api/v1/payments?includeVoided=true')).body.total).toBe(2);
    expect((await a.api.get('/api/v1/payments?method=cash&includeVoided=true')).body.total).toBe(1);
    expect(
      (await a.api.get(`/api/v1/payments?from=${addDays(today, 1)}&to=${addDays(today, 2)}`)).body
        .total
    ).toBe(0);
  });

  it('GET /payments/:id returns receipt data', async () => {
    const p = (await pay(a.api, { amount: 50000 })).body.payment;
    const res = await a.api.get(`/api/v1/payments/${p._id}`);
    expect(res.status).toBe(200);
    // The worker's language picks the language of the WhatsApp receipt message.
    expect(res.body.worker).toMatchObject({
      name: 'Ramesh Yadav',
      role: 'mason',
      preferredLanguage: expect.stringMatching(/^(en|hi)$/),
    });
    expect(res.body.site).toMatchObject({ name: 'Prestige Lakeside' });
    expect(res.body.contractor).toEqual({ name: 'Ravi Kumar', phone: '9800000001' });
  });

  it('dues and advances lists are sorted and totalled', async () => {
    const suresh = await createWorker(a.api, { name: 'Suresh Patil' });
    const zakir = await createWorker(a.api, { name: 'Zakir Hussain' });
    const idle = await createWorker(a.api, { name: 'Idle Worker' });
    await markDays(a.api, suresh, [-2, -1]); // ₹1,000
    await pay(a.api, { workerId: zakir._id, amount: 30000, type: 'advance' });
    await pay(a.api, { workerId: suresh._id, amount: 100, type: 'advance', method: 'cash' });
    await a.api.post(`/api/v1/workers/${ramesh._id}/deactivate`);
    const res = await a.api.get('/api/v1/payments/dues');
    expect(res.status).toBe(200);
    expect(res.body.dues.map((d) => [d.name, d.balance])).toEqual([
      ['Ramesh Yadav', 200000],
      ['Suresh Patil', 99900],
    ]);
    expect(res.body.dues[0]).toMatchObject({
      siteName: 'Prestige Lakeside',
      earned: 200000,
      paid: 0,
      role: 'mason',
    });
    expect(res.body.advances.map((d) => [d.name, d.balance])).toEqual([['Zakir Hussain', -30000]]);
    expect(res.body.totals).toEqual({ pending: 299900, advance: 30000, workersWithDues: 2 });
    expect(res.body.dues.find((d) => d.workerId === idle._id)).toBeUndefined();
  });

  it('worker summary matches the ledger', async () => {
    await pay(a.api, { amount: 50000 });
    await pay(a.api, { amount: 10000, type: 'advance' });
    const res = await a.api.get(`/api/v1/workers/${ramesh._id}/summary`);
    expect(res.status).toBe(200);
    expect(res.body.balance).toEqual({
      earned: 200000,
      paidWage: 50000,
      paidAdvance: 10000,
      paid: 60000,
      balance: 140000,
    });
    expect(res.body.recentAttendance).toHaveLength(4);
    expect(res.body.recentAttendance[0].day).toBe(addDays(today, -1));
    expect(res.body.recentPayments).toHaveLength(2);
    expect(res.body.site.name).toBe('Prestige Lakeside');
  });
});

describe('tenant isolation', () => {
  it("contractor B cannot see, void or pay A's records", async () => {
    const p = (await pay(a.api, { amount: 50000 })).body.payment;
    expect((await b.api.get(`/api/v1/payments/${p._id}`)).status).toBe(404);
    expect(
      (await b.api.post(`/api/v1/payments/${p._id}/void`, { reason: 'Not mine' })).status
    ).toBe(404);
    expect((await pay(b.api, { amount: 100, type: 'advance' })).status).toBe(404);
    expect((await b.api.get(`/api/v1/workers/${ramesh._id}/summary`)).status).toBe(404);
    expect((await b.api.get('/api/v1/payments')).body.total).toBe(0);
    expect((await b.api.get('/api/v1/payments/dues')).body.dues).toEqual([]);
  });
});
