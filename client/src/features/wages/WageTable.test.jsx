import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { API, HttpResponse, http, server } from '../../test/server.js';
import { renderWithProviders } from '../../test/render.jsx';
import { WageTable } from './WageTable.jsx';
import { WageCards } from './WageCards.jsx';

// The walkthrough's "impossible" row: nothing earned this week, a payment for earlier work,
// and nothing left to pay. Each figure must say which period it covers.
const row = {
  workerId: 'w1',
  name: 'Ramesh Yadav',
  role: 'mason',
  present: 0,
  halfDay: 0,
  absent: 0,
  earned: 0,
  paidInPeriod: 1557500,
  wagesPaidInPeriod: 1507500,
  advancesInPeriod: 50000,
  balance: -50000,
  buckets: [{ start: '2026-10-26', present: 0, halfDay: 0, absent: 0, earned: 0 }],
};
const data = {
  from: '2026-10-26',
  to: '2026-10-28',
  groupBy: 'week',
  buckets: [{ start: '2026-10-26', end: '2026-10-28' }],
  workers: [row],
  totals: { ...row },
};

describe('WageTable', () => {
  it('labels every money column with the period it covers, advances included', () => {
    renderWithProviders(<WageTable data={data} />);
    for (const name of [
      'Earned (this period)',
      'Wages paid (this period)',
      'Advances given (this period)',
      'Balance due (all time)',
    ])
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual(
      expect.arrayContaining(['₹0', '₹15,075', '₹500', '₹500 advance'])
    );
  });

  it('opens the day-by-day breakdown the wage slip shows', async () => {
    let query;
    server.use(
      http.get(API('/workers/w1/slip'), ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json({
          days: [
            { day: '2026-10-26', status: 'present', rate: 88000, earned: 88000 },
            { day: '2026-10-27', status: 'half-day', rate: 88000, earned: 44000 },
          ],
          totals: { earned: 132000, wagesPaid: 0, advancesPaid: 0 },
          openingBalance: 0,
          closingBalance: 132000,
        });
      })
    );
    renderWithProviders(<WageTable data={data} />);
    await userEvent.click(screen.getByRole('button', { name: 'Show breakdown for Ramesh Yadav' }));
    const days = await screen.findByRole('table', { name: 'Breakdown for Ramesh Yadav' });
    expect(query.get('from')).toBe('2026-10-26');
    expect(query.get('to')).toBe('2026-10-28');
    const rows = within(days).getAllByRole('row').slice(1);
    expect(
      rows.map((r) =>
        within(r)
          .getAllByRole('cell')
          .map((c) => c.textContent)
      )
    ).toEqual([
      ['26 Oct, Mon', 'Present', '₹880', '₹880'],
      ['27 Oct, Tue', 'Half-day', '₹880', '₹440'],
    ]);
  });

  it('explains how the period figures lead to the all-time balance', async () => {
    // The tester's row: 27 Oct only, earned ₹600, nothing paid that day, balance ₹700. The other
    // ₹100 is from 28 Oct, after the chosen period.
    const one = {
      ...row,
      present: 1,
      earned: 60000,
      paidInPeriod: 0,
      wagesPaidInPeriod: 0,
      advancesInPeriod: 0,
      balance: 70000,
    };
    server.use(
      http.get(API('/workers/w1/slip'), () =>
        HttpResponse.json({
          days: [{ day: '2026-10-27', status: 'present', rate: 60000, earned: 60000 }],
          totals: { earned: 60000, wagesPaid: 0, advancesPaid: 0 },
          openingBalance: 0,
          closingBalance: 60000,
        })
      )
    );
    renderWithProviders(
      <WageTable
        data={{ ...data, from: '2026-10-27', to: '2026-10-27', workers: [one], totals: one }}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Show breakdown for Ramesh Yadav' }));
    const sum = await screen.findByRole('list', { name: 'How the balance due is made up' });
    expect(
      within(sum)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual([
      'Owed before this period₹0',
      'Earned in this period+ ₹600',
      'Paid in this period− ₹0',
      'From after this period+ ₹100',
      'Balance due (all time)₹700',
    ]);
  });
});

describe('WageCards', () => {
  it('uses the same labels on a phone', () => {
    renderWithProviders(<WageCards data={data} />);
    for (const label of [
      'Wages paid (this period)',
      'Advances given (this period)',
      'Balance due (all time)',
    ])
      expect(screen.getByText(label)).toBeInTheDocument();
  });
});
