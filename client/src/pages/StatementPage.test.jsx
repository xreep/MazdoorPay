import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { API, HttpResponse, http, server } from '../test/server.js';
import { renderWithProviders } from '../test/render.jsx';
import StatementPage from './StatementPage.jsx';

const statement = (overrides = {}) => ({
  worker: { name: 'Ramesh Yadav', role: 'mason', preferredLanguage: 'en' },
  contractor: { name: 'Ravi Kumar' },
  since: '2026-07-28',
  balance: { earned: 120000, paid: 30000, paidWage: 30000, paidAdvance: 0, balance: 90000 },
  days: [
    { day: '2026-10-25', status: 'half-day', earned: 40000 },
    { day: '2026-10-24', status: 'present', earned: 80000 },
  ],
  payments: [
    {
      day: '2026-10-25',
      amount: 30000,
      type: 'wage',
      method: 'cash',
      reference: null,
      voided: false,
    },
    {
      day: '2026-10-24',
      amount: 50000,
      type: 'wage',
      method: 'cash',
      reference: null,
      voided: true,
    },
  ],
  ...overrides,
});

const render = (respond) => {
  server.use(http.get(API('/statements/tok123'), respond));
  renderWithProviders(<StatementPage />, { path: '/s/:token', route: '/s/tok123', user: null });
};

describe('StatementPage', () => {
  it('shows the worker what they are owed and their last 90 days', async () => {
    render(() => HttpResponse.json(statement()));
    expect(await screen.findByRole('heading', { name: 'Ramesh Yadav' })).toBeInTheDocument();
    expect(screen.getByText('Mason · From Ravi Kumar')).toBeInTheDocument();
    const balance = screen.getByRole('region', { name: 'You are owed' });
    expect(within(balance).getByText('₹900')).toBeInTheDocument();
    expect(screen.getByText('1 full days · 1 half days')).toBeInTheDocument();
    const payments = screen.getByRole('list', { name: 'Payments' });
    expect(within(payments).getAllByRole('listitem')).toHaveLength(2);
    expect(within(payments).getByText('Void')).toBeInTheDocument();
  });

  it("is written in the worker's language", async () => {
    render(() =>
      HttpResponse.json(
        statement({
          worker: { name: 'रमेश यादव', role: 'mason', preferredLanguage: 'hi' },
          balance: { earned: 0, paid: 50000, paidWage: 0, paidAdvance: 50000, balance: -50000 },
        })
      )
    );
    expect(await screen.findByRole('heading', { name: 'रमेश यादव' })).toBeInTheDocument();
    const balance = screen.getByRole('region', { name: 'एडवांस जो लौटाना है' });
    expect(within(balance).getByText('₹500')).toBeInTheDocument();
  });

  it('explains a stopped or replaced link', async () => {
    render(() =>
      HttpResponse.json(
        { error: 'This link is not valid any more. Ask your contractor for a new one.' },
        { status: 404 }
      )
    );
    expect(
      await screen.findByRole('heading', { name: 'This link does not work' })
    ).toBeInTheDocument();
  });
});
