import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { API, HttpResponse, http, server } from '../test/server.js';
import { renderWithProviders } from '../test/render.jsx';
import { sitesResponse } from '../test/fixtures.js';
import WagesPage from './WagesPage.jsx';

const summary = (from, to) => ({
  from,
  to,
  groupBy: 'week',
  buckets: [{ start: from, end: to, present: 17, halfDay: 1, absent: 0, earned: 1540000 }],
  workers: [
    {
      workerId: 'w1',
      name: 'Ramesh Yadav',
      role: 'mason',
      present: 17,
      halfDay: 1,
      absent: 0,
      earned: 1540000,
      paidInPeriod: 1050000,
      wagesPaidInPeriod: 1000000,
      advancesInPeriod: 50000,
      balance: 490000,
      buckets: [{ start: from, present: 17, halfDay: 1, absent: 0, earned: 1540000 }],
    },
  ],
  totals: {
    present: 17,
    halfDay: 1,
    absent: 0,
    earned: 1540000,
    paidInPeriod: 1050000,
    wagesPaidInPeriod: 1000000,
    advancesInPeriod: 50000,
    balance: 490000,
  },
});

const render = (route = '/wages', requests = []) => {
  server.use(
    http.get(API('/sites'), () => HttpResponse.json(sitesResponse)),
    http.get(API('/wages/summary'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      return HttpResponse.json(summary(params.get('from'), params.get('to')));
    })
  );
  renderWithProviders(<WagesPage />, { path: '/wages', route });
};

describe('WagesPage', () => {
  it('says which figures cover the period and which cover all time', async () => {
    render();
    expect(await screen.findByText('Earned in this period')).toBeInTheDocument();
    expect(screen.getByText('Paid in this period')).toBeInTheDocument();
    expect(screen.getByText('Wages ₹10,000 · advances ₹500')).toBeInTheDocument();
    expect(screen.getByText('Balance due (all time)')).toBeInTheDocument();
    expect(
      screen.getByText(/Payments in a period can be for work done earlier/)
    ).toBeInTheDocument();
  });

  it('states the half-day rule', async () => {
    render();
    expect(
      await screen.findByText(
        'Present earns the full daily wage, half-day earns half of it, absent earns nothing.'
      )
    ).toBeInTheDocument();
  });

  it('opens at the dates given in the link, so other screens can point to the same days', async () => {
    const requests = [];
    render('/wages?from=2026-09-29&to=2026-10-28', requests);
    await screen.findByText('Earned in this period');
    expect(requests.at(-1).get('from')).toBe('2026-09-29');
    expect(requests.at(-1).get('to')).toBe('2026-10-28');
    expect(screen.getByRole('radio', { name: 'Choose dates' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });
});
