import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render.jsx';
import { WageTable } from './WageTable.jsx';
import { WageCards } from './WageCards.jsx';

const data = {
  from: '2026-10-01',
  to: '2026-10-25',
  groupBy: 'week',
  buckets: [{ start: '2026-10-19', end: '2026-10-25' }],
  workers: [
    {
      workerId: 'w1',
      name: 'Ramesh Yadav',
      role: 'mason',
      present: 5,
      halfDay: 0,
      absent: 1,
      earned: 250000,
      paidInPeriod: 100000,
      balance: 150000,
      buckets: [{ start: '2026-10-19', present: 5, halfDay: 0, absent: 1, earned: 250000 }],
    },
  ],
  totals: { earned: 250000, paidInPeriod: 100000, balance: 150000 },
};

describe("each worker's wage slip for the period on screen", () => {
  it.each([
    ['table', WageTable],
    ['phone cards', WageCards],
  ])('is linked from the %s', (_, Component) => {
    renderWithProviders(<Component data={data} />);
    expect(screen.getByRole('link', { name: 'Wage slip for Ramesh Yadav' })).toHaveAttribute(
      'href',
      '/print/wage-slip/w1?from=2026-10-01&to=2026-10-25'
    );
  });
});
