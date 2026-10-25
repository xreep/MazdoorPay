import { describe, expect, it } from 'vitest';
import { receiptMessage, weeklySummaryMessage, whatsappLink } from './whatsapp.js';

const payment = {
  _id: '64b7f0c2a1b2c3d4e5f61a2b',
  amount: 450000,
  type: 'wage',
  method: 'upi',
  reference: '412345678901',
  day: '2026-10-24',
};
const contractor = { name: 'Ravi Kumar' };

describe('whatsappLink', () => {
  it("opens the worker's chat with an Indian number and the message", () => {
    const url = new URL(whatsappLink('9876543210', 'Namaste Ramesh,\n₹4,500 & more'));
    expect(url.origin + url.pathname).toBe('https://wa.me/919876543210');
    expect(url.searchParams.get('text')).toBe('Namaste Ramesh,\n₹4,500 & more');
  });

  it('lets the contractor pick the chat when the worker has no phone', () => {
    const url = new URL(whatsappLink(null, 'Hello'));
    expect(url.origin + url.pathname).toBe('https://wa.me/');
    expect(url.searchParams.get('text')).toBe('Hello');
  });
});

describe('receiptMessage', () => {
  it('writes an English receipt with the UTR and receipt number', () => {
    const text = receiptMessage({
      payment,
      worker: { name: 'Ramesh Yadav', preferredLanguage: 'en' },
      contractor,
    });
    expect(text).toBe(
      [
        'Namaste Ramesh Yadav,',
        'Payment received: ₹4,500',
        'Wages · UPI · Sat, 24 Oct 2026',
        'UTR: 412345678901',
        'Receipt no. E5F61A2B',
        '— Ravi Kumar',
      ].join('\n')
    );
  });

  it('uses Hindi for a worker who prefers it, and leaves out a missing reference', () => {
    const text = receiptMessage({
      payment: { ...payment, type: 'advance', method: 'cash', reference: null },
      worker: { name: 'रमेश', preferredLanguage: 'hi' },
      contractor,
    });
    expect(text.split('\n')[0]).toBe('नमस्ते रमेश,');
    expect(text).toMatch('₹4,500 का भुगतान');
    expect(text).toMatch('एडवांस · नकद');
    expect(text).not.toMatch('UTR');
    expect(text).toMatch('रसीद नं. E5F61A2B');
  });
});

describe('weeklySummaryMessage', () => {
  const base = {
    worker: { name: 'Ramesh Yadav', preferredLanguage: 'en' },
    contractorName: 'Ravi Kumar',
    today: '2026-10-24', // Saturday; the week started Monday 19 Oct
    attendance: [
      { day: '2026-10-24', status: 'present', earned: 65000 },
      { day: '2026-10-23', status: 'half-day', earned: 32500 },
      { day: '2026-10-22', status: 'absent', earned: 0 },
      { day: '2026-10-19', status: 'present', earned: 65000 },
      { day: '2026-10-18', status: 'present', earned: 65000 }, // last week
    ],
    payments: [
      { day: '2026-10-24', amount: 100000, voidedAt: null },
      { day: '2026-10-21', amount: 50000, voidedAt: '2026-10-21T10:00:00Z' }, // voided
      { day: '2026-10-17', amount: 90000, voidedAt: null }, // last week
    ],
    balance: { balance: 62500 },
  };

  it("sums only this week's days and payments, and states the balance", () => {
    expect(weeklySummaryMessage(base)).toBe(
      [
        'Namaste Ramesh Yadav,',
        'Your work this week (19 Oct – 24 Oct):',
        'Full days 2 · Half days 1',
        'Earned ₹1,625 · Paid ₹1,000',
        'Balance due: ₹625',
        '— Ravi Kumar',
      ].join('\n')
    );
  });

  it('says when an advance is still to be recovered, or all is settled', () => {
    expect(weeklySummaryMessage({ ...base, balance: { balance: -50000 } })).toMatch(
      'Advance still to recover: ₹500'
    );
    expect(weeklySummaryMessage({ ...base, balance: { balance: 0 } })).toMatch('All settled');
  });

  it('writes the summary in Hindi', () => {
    const text = weeklySummaryMessage({
      ...base,
      worker: { name: 'रमेश', preferredLanguage: 'hi' },
    });
    expect(text).toMatch('इस हफ़्ते का काम');
    expect(text).toMatch('पूरे दिन 2 · आधे दिन 1');
    expect(text).toMatch('कमाई ₹1,625 · भुगतान ₹1,000');
    expect(text).toMatch('बाकी: ₹625');
  });
});
