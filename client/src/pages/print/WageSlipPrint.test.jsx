import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { API, HttpResponse, http, server } from '../../test/server.js';
import { renderWithProviders } from '../../test/render.jsx';
import WageSlipPrint from './WageSlipPrint.jsx';

const slip = (overrides = {}) => ({
  worker: { _id: 'w1', name: 'Ramesh Yadav', role: 'mason', dailyRate: 50000 },
  site: { name: 'Prestige Lakeside' },
  contractor: { name: 'Ravi Kumar', phone: '9800000001' },
  from: '2026-10-19',
  to: '2026-10-25',
  days: [
    { day: '2026-10-19', status: 'present', rate: 50000, earned: 50000 },
    { day: '2026-10-20', status: 'half-day', rate: 50000, earned: 25000 },
    { day: '2026-10-21', status: 'absent', rate: 50000, earned: 0 },
  ],
  payments: [
    {
      _id: 'p1',
      day: '2026-10-20',
      amount: 30000,
      type: 'wage',
      method: 'upi',
      reference: '412345678901',
    },
  ],
  totals: { present: 1, halfDay: 1, absent: 1, earned: 75000, wagesPaid: 30000, advancesPaid: 0 },
  openingBalance: 112500,
  closingBalance: 157500,
  ...overrides,
});

const render = (data, captured = {}) => {
  server.use(
    http.get(API('/workers/w1/slip'), ({ request }) => {
      captured.query = new URL(request.url).searchParams;
      return HttpResponse.json(data);
    })
  );
  renderWithProviders(<WageSlipPrint />, {
    path: '/print/wage-slip/:id',
    route: '/print/wage-slip/w1?from=2026-10-19&to=2026-10-25',
  });
};

describe('WageSlipPrint', () => {
  it('shows the period from previous balance to balance due, day by day', async () => {
    const captured = {};
    render(slip(), captured);
    expect(await screen.findByRole('heading', { name: 'Wage slip' })).toBeInTheDocument();
    expect(captured.query.get('from')).toBe('2026-10-19');
    expect(captured.query.get('to')).toBe('2026-10-25');
    expect(screen.getByText('Ramesh Yadav')).toBeInTheDocument();

    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getByText('Previous balance').nextSibling).toHaveTextContent('₹1,125');
    expect(within(summary).getByText('Earned in this period').nextSibling).toHaveTextContent(
      '+ ₹750'
    );
    expect(within(summary).getByText('Wages paid').nextSibling).toHaveTextContent('− ₹300');
    // Advances are always listed, even when none were given, so the sum is visible in full.
    expect(within(summary).getByText('Advances paid').nextSibling).toHaveTextContent('− ₹0');
    expect(within(summary).getByText('Balance due').nextSibling).toHaveTextContent('₹1,575');

    const days = screen.getByRole('table', { name: 'Attendance' });
    expect(within(days).getAllByRole('row')).toHaveLength(5); // header, 3 days, total
    expect(within(days).getByText('Half-day')).toBeInTheDocument();
    const payments = screen.getByRole('table', { name: 'Payments' });
    expect(within(payments).getByText('412345678901')).toBeInTheDocument();
  });

  it('calls a negative closing balance an advance still to recover', async () => {
    render(slip({ closingBalance: -20000, payments: [], days: [] }));
    const summary = await screen.findByRole('region', { name: 'Summary' });
    expect(within(summary).getByText('Advance still to recover').nextSibling).toHaveTextContent(
      '₹200'
    );
    expect(screen.getByText('No attendance marked in this period.')).toBeInTheDocument();
  });
});
