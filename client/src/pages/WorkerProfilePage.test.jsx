import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { API, HttpResponse, http, server } from '../test/server.js';
import { renderWithProviders } from '../test/render.jsx';
import { sitesResponse, worker } from '../test/fixtures.js';
import WorkerProfilePage from './WorkerProfilePage.jsx';

const summary = (overrides = {}) => ({
  worker: worker(),
  site: sitesResponse.sites[0],
  balance: {
    earned: 1900000,
    paid: 1760000,
    paidWage: 1710000,
    paidAdvance: 50000,
    balance: 140000,
  },
  recentAttendance: [
    { _id: 'a1', day: '2026-10-24', status: 'present', earned: 95000 },
    { _id: 'a2', day: '2026-10-23', status: 'half-day', earned: 47500 },
  ],
  recentPayments: [
    {
      _id: 'p1',
      day: '2026-10-24',
      amount: 450000,
      type: 'wage',
      method: 'cash',
      voidedAt: '2026-10-24T10:00:00Z',
      voidReason: 'Entered ₹4,500 instead of ₹450',
    },
    {
      _id: 'p2',
      day: '2026-10-24',
      amount: 45000,
      type: 'wage',
      method: 'upi',
      reference: '412345678901',
      voidedAt: null,
    },
  ],
  ...overrides,
});

const render = () =>
  renderWithProviders(<WorkerProfilePage />, { path: '/workers/:id', route: '/workers/w1' });

const base = (s = summary()) => [
  http.get(API('/workers/w1/summary'), () => HttpResponse.json(s)),
  http.get(API('/sites'), () => HttpResponse.json(sitesResponse)),
];

describe('WorkerProfilePage', () => {
  it('shows balance, attendance calendar and payments', async () => {
    server.use(...base());
    render();
    expect(await screen.findByRole('heading', { name: 'Ramesh Kumar' })).toBeInTheDocument();
    const balance = screen.getByRole('region', { name: 'Money' });
    expect(within(balance).getByText('₹19,000')).toBeInTheDocument();
    expect(within(balance).getByText('₹17,600')).toBeInTheDocument();
    expect(within(balance).getByText('₹1,400')).toBeInTheDocument();
    expect(screen.getByLabelText('24 Oct, Sat: Present')).toBeInTheDocument();
    expect(screen.getByLabelText('23 Oct, Fri: Half-day')).toBeInTheDocument();
    const voided = screen.getByText('Entered ₹4,500 instead of ₹450').closest('li');
    expect(within(voided).getByText('Void')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Record payment' })).toHaveAttribute(
      'href',
      '/payments?record=1&workerId=w1'
    );
  });

  it("offers this week's summary on WhatsApp, written in the worker's language", async () => {
    server.use(...base());
    render();
    const link = await screen.findByRole('link', { name: 'Send week on WhatsApp' });
    const url = new URL(link.getAttribute('href'));
    expect(url.origin + url.pathname).toBe('https://wa.me/919876543210');
    const text = url.searchParams.get('text');
    expect(text.split('\n')[0]).toBe('नमस्ते Ramesh Kumar,');
    expect(text).toMatch('बाकी: ₹1,400');
    expect(text).toMatch('— Ravi Kumar');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('says "advance outstanding" when the balance is negative', async () => {
    server.use(
      ...base(
        summary({
          balance: { earned: 0, paid: 50000, paidWage: 0, paidAdvance: 50000, balance: -50000 },
        })
      )
    );
    render();
    expect(await screen.findByText('Advance outstanding')).toBeInTheDocument();
  });

  it('changes the rate and reports recalculated days', async () => {
    let body;
    server.use(
      ...base(),
      http.post(API('/workers/w1/rate'), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ worker: worker({ dailyRate: 100000 }), repricedDays: 3 });
      })
    );
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Change rate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change daily wage' });
    expect(
      within(dialog).getByText(/Days already marked from .* will be recalculated/)
    ).toBeInTheDocument();
    await userEvent.clear(within(dialog).getByLabelText('New daily wage'));
    await userEvent.type(within(dialog).getByLabelText('New daily wage'), '1000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rate' }));
    await waitFor(() => expect(body.dailyRate).toBe(100000));
    expect(await screen.findByText('Rate updated · 3 days recalculated')).toBeInTheDocument();
  });

  it('asks before deactivating', async () => {
    let called = false;
    server.use(
      ...base(),
      http.post(API('/workers/w1/deactivate'), () => {
        called = true;
        return HttpResponse.json({ worker: worker({ isActive: false }) });
      })
    );
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate Ramesh Kumar?' });
    expect(called).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(called).toBe(true));
  });
});
