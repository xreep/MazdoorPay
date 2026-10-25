import { describe, expect, it } from 'vitest';
import { upiPayLink } from './upi.js';

describe('upiPayLink', () => {
  it('fills in the payee, amount in rupees and a note for the UPI app', () => {
    const link = upiPayLink({
      upiId: 'ramesh.y@oksbi',
      name: 'Ramesh Yadav',
      amount: 450050,
      note: 'Wages 24 Oct',
    });
    expect(link).toBe(
      'upi://pay?pa=ramesh.y@oksbi&pn=Ramesh%20Yadav&am=4500.50&cu=INR&tn=Wages%2024%20Oct'
    );
  });

  it('encodes names that are not plain English', () => {
    const link = upiPayLink({ upiId: 'r@ybl', name: 'रमेश & Sons', amount: 100, note: 'x' });
    const params = new URLSearchParams(link.split('?')[1]);
    expect(params.get('pn')).toBe('रमेश & Sons');
    expect(params.get('am')).toBe('1.00');
    expect(link).toMatch(/^[\x21-\x7e]+$/); // plain ASCII, safe to put in a QR code
  });
});
