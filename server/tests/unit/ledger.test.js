import mongoose from 'mongoose';
import { useTestDb } from '../helpers/db.js';
import { Attendance } from '../../src/models/Attendance.js';
import { Payment } from '../../src/models/Payment.js';
import { getBalance, getBalances } from '../../src/services/ledger.service.js';

useTestDb();

const id = () => new mongoose.Types.ObjectId();
const contractor = id();
const other = id();
const w1 = id();
const w2 = id();
const site = id();

const att = (contractorId, workerId, day, earned) => ({
  contractorId,
  workerId,
  siteId: site,
  day,
  status: 'present',
  rateSnapshot: earned,
  earned,
  markedBy: contractorId,
});
const pay = (contractorId, workerId, amount, type, extra = {}) => ({
  contractorId,
  workerId,
  amount,
  type,
  method: 'cash',
  day: '2026-10-20',
  recordedBy: contractorId,
  idempotencyKey: crypto.randomUUID(),
  ...extra,
});

beforeEach(async () => {
  await Attendance.insertMany([
    att(contractor, w1, '2026-10-01', 50000),
    att(contractor, w1, '2026-10-02', 50000),
    att(contractor, w2, '2026-10-01', 40000),
    att(other, id(), '2026-10-01', 99999),
  ]);
  await Payment.insertMany([
    pay(contractor, w1, 30000, 'wage'),
    pay(contractor, w1, 10000, 'advance'),
    pay(contractor, w1, 20000, 'wage', { voidedAt: new Date(), voidReason: 'Typo' }),
    pay(contractor, w2, 60000, 'advance'),
  ]);
});

it('balance = earned − (wages + advances), voided excluded', async () => {
  const balances = await getBalances(contractor);
  expect(balances.get(String(w1))).toEqual({
    earned: 100000,
    paidWage: 30000,
    paidAdvance: 10000,
    paid: 40000,
    balance: 60000,
  });
  expect(balances.get(String(w2))).toEqual({
    earned: 40000,
    paidWage: 0,
    paidAdvance: 60000,
    paid: 60000,
    balance: -20000,
  });
  expect(balances.size).toBe(2);
});

it('limits to the requested workers and gives zeros for unknown ones', async () => {
  const stranger = id();
  const balances = await getBalances(contractor, { workerIds: [w2, stranger] });
  expect([...balances.keys()].sort()).toEqual([String(w2), String(stranger)].sort());
  expect(balances.get(String(stranger))).toEqual({
    earned: 0,
    paidWage: 0,
    paidAdvance: 0,
    paid: 0,
    balance: 0,
  });
  expect(await getBalance(contractor, w1)).toMatchObject({ balance: 60000 });
});

it("never counts another contractor's records", async () => {
  expect((await getBalance(other, w1)).balance).toBe(0);
});
