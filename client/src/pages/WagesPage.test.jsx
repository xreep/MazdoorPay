import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { API, HttpResponse, http, server } from '../test/server.js';
import { renderWithProviders } from '../test/render.jsx';
import { S1, sitesResponse } from '../test/fixtures.js';
import WagesPage from './WagesPage.jsx';

const summary = (groupBy) => ({
  from: '2026-10-19',
  to: '2026-10-25',
  groupBy,
  buckets: [
    { start: '2026-10-19', end: '2026-10-25', present: 9, halfDay: 1, absent: 4, earned: 712500 },
  ],
  workers: [
    {
      workerId: 'w1',
      name: 'Ramesh Kumar',
      role: 'mason',
      siteId: S1,
      present: 5,
      halfDay: 1,
      absent: 1,
      earned: 522500,
      paidInPeriod: 400000,
      balance: 122500,
      buckets: [{ start: '2026-10-19', present: 5, halfDay: 1, absent: 1, earned: 522500 }],
    },
    {
      workerId: 'w2',
      name: 'Kishan Lal',
      role: 'helper',
      siteId: S1,
      present: 4,
      halfDay: 0,
      absent: 3,
      earned: 190000,
      paidInPeriod: 240000,
      balance: -50000,
      buckets: [{ start: '2026-10-19', present: 4, halfDay: 0, absent: 3, earned: 190000 }],
    },
  ],
  totals: {
    present: 9,
    halfDay: 1,
    absent: 4,
    earned: 712500,
    paidInPeriod: 640000,
    balance: 72500,
  },
});

function handlers(requests) {
  return [
    http.get(API('/sites'), () => HttpResponse.json(sitesResponse)),
    http.get(API('/wages/summary'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      return HttpResponse.json(summary(params.get('groupBy')));
    }),
  ];
}

const render = () => renderWithProviders(<WagesPage />, { path: '/wages', route: '/wages' });

describe('WagesPage', () => {
  it('shows totals and per-worker earnings for the week', async () => {
    const requests = [];
    server.use(...handlers(requests));
    render();
    await screen.findByRole('row', { name: /Ramesh Kumar/ });
    expect(
      within(screen.getByRole('region', { name: 'Earned in this period' })).getByText('₹7,125')
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Paid in this period' })).getByText('₹6,400')
    ).toBeInTheDocument();
    expect(requests[0].get('groupBy')).toBe('week');
    const ramesh = screen.getByRole('row', { name: /Ramesh Kumar/ });
    expect(within(ramesh).getByText('₹5,225')).toBeInTheDocument();
    expect(
      within(screen.getByRole('row', { name: /Kishan Lal/ })).getByText('₹500 advance')
    ).toBeInTheDocument();
  });

  it('daily / weekly toggle changes the grouping', async () => {
    const requests = [];
    server.use(...handlers(requests));
    render();
    await screen.findByRole('row', { name: /Ramesh Kumar/ });
    await userEvent.click(screen.getByRole('radio', { name: 'Daily' }));
    await waitFor(() => expect(requests.at(-1).get('groupBy')).toBe('day'));
  });

  it('a worker row expands to show each period', async () => {
    server.use(...handlers([]));
    render();
    await screen.findByRole('row', { name: /Ramesh Kumar/ });
    await userEvent.click(screen.getByRole('button', { name: 'Show breakdown for Ramesh Kumar' }));
    const list = await screen.findByRole('list', { name: 'Breakdown for Ramesh Kumar' });
    expect(within(list).getByText('19 Oct, Mon – 25 Oct, Sun')).toBeInTheDocument();
  });

  it('site filter, register download and print use the same range', async () => {
    const requests = [];
    const downloads = [];
    server.use(
      ...handlers(requests),
      http.get(API('/reports/wage-register'), ({ request }) => {
        downloads.push(new URL(request.url).searchParams);
        return new HttpResponse('Name\r\n', { headers: { 'Content-Type': 'text/csv' } });
      })
    );
    render();
    await screen.findByRole('row', { name: /Ramesh Kumar/ });
    await userEvent.selectOptions(screen.getByLabelText('Site'), S1);
    await waitFor(() => expect(requests.at(-1).get('siteId')).toBe(S1));
    const { from, to } = Object.fromEntries(requests.at(-1));
    await userEvent.click(screen.getByRole('button', { name: 'Download wage register (CSV)' }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(Object.fromEntries(downloads[0])).toMatchObject({ from, to, siteId: S1, format: 'csv' });
    expect(screen.getByRole('link', { name: 'Print wage register' })).toHaveAttribute(
      'href',
      `/print/wage-register?from=${from}&to=${to}&siteId=${S1}`
    );
  });

  it('on a phone shows each worker as a card with the money visible', async () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn((query) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    server.use(...handlers([]));
    render();
    const list = await screen.findByRole('list', { name: 'Wages per worker' });
    expect(screen.queryByRole('table')).toBeNull();
    const card = within(list).getAllByRole('listitem')[0];
    expect(within(card).getByText('Ramesh Kumar')).toBeInTheDocument();
    expect(within(card).getByText('₹5,225')).toBeInTheDocument();
    expect(within(card).getByText('₹1,225')).toBeInTheDocument();
    window.matchMedia = original;
  });
});

afterEach(() => vi.restoreAllMocks());
