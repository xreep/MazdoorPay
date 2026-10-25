import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { API, HttpResponse, http, server } from '../../test/server.js';
import { renderWithProviders } from '../../test/render.jsx';
import ReceiptPrint from './ReceiptPrint.jsx';

const receipt = (payment = {}) => ({
  payment: {
    _id: '64b7f0c2a1b2c3d4e5f61a2b',
    amount: 450000,
    type: 'wage',
    method: 'upi',
    reference: '412345678901',
    day: '2026-10-24',
    voidedAt: null,
    ...payment,
  },
  worker: { name: 'Ramesh Yadav', role: 'mason', phone: '9876543210', preferredLanguage: 'en' },
  site: { name: 'Prestige Lakeside' },
  contractor: { name: 'Ravi Kumar', phone: '9800000001' },
});

const render = (data) => {
  server.use(http.get(API('/payments/p1'), () => HttpResponse.json(data)));
  renderWithProviders(<ReceiptPrint />, { path: '/print/receipt/:id', route: '/print/receipt/p1' });
};

describe('ReceiptPrint', () => {
  it('sends the receipt to the worker on WhatsApp', async () => {
    render(receipt());
    const link = await screen.findByRole('link', { name: 'Send on WhatsApp' });
    const url = new URL(link.getAttribute('href'));
    expect(url.origin + url.pathname).toBe('https://wa.me/919876543210');
    expect(url.searchParams.get('text')).toMatch('Payment received: ₹4,500');
    expect(url.searchParams.get('text')).toMatch('UTR: 412345678901');
  });

  it("is printed in the worker's language", async () => {
    const data = receipt();
    render({ ...data, worker: { ...data.worker, preferredLanguage: 'hi' } });
    expect(await screen.findByRole('heading', { name: 'भुगतान की रसीद' })).toBeInTheDocument();
    expect(screen.getByText('शनिवार, 24 अक्टूबर 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'WhatsApp पर भेजें' })).toBeInTheDocument();
  });

  it('does not offer WhatsApp for a voided payment', async () => {
    render(receipt({ voidedAt: '2026-10-24T10:00:00Z', voidReason: 'Wrong amount' }));
    expect(await screen.findByText('Wrong amount')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Send on WhatsApp' })).toBeNull();
  });
});
