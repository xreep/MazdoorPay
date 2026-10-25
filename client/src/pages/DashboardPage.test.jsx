import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { API, HttpResponse, delay, http, server } from '../test/server.js';
import { renderWithProviders } from '../test/render.jsx';
import DashboardPage from './DashboardPage.jsx';

const trend = Array.from({ length: 30 }, (_, i) => ({
  day: `2026-10-${String(i + 1).padStart(2, '0')}`,
  present: 10,
  halfDay: 1,
  absent: 2,
  earned: 900000,
}));
const dashboard = {
  today: '2026-10-25',
  sites: [
    {
      siteId: 's1',
      name: 'Prestige Lakeside – Whitefield',
      activeWorkers: 12,
      marked: 8,
      present: 6,
      halfDay: 1,
      absent: 1,
    },
    {
      siteId: 's2',
      name: 'Sobha Tower – Hebbal',
      activeWorkers: 4,
      marked: 0,
      present: 0,
      halfDay: 0,
      absent: 0,
    },
  ],
  money: {
    pendingDues: 7365500,
    advanceOutstanding: 150000,
    workersWithDues: 9,
    paidThisWeek: 6279500,
  },
  trend,
  counts: { activeSites: 2, activeWorkers: 16 },
};

describe('DashboardPage', () => {
  it("shows today's progress per site with a link to mark attendance", async () => {
    server.use(http.get(API('/dashboard'), () => HttpResponse.json(dashboard)));
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Sunday, 25 October 2026')).toBeInTheDocument();
    const card = screen.getByRole('article', { name: 'Prestige Lakeside – Whitefield' });
    expect(within(card).getByText('8 of 12 marked')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /Mark attendance/ })).toHaveAttribute(
      'href',
      '/attendance?siteId=s1'
    );
    expect(
      within(screen.getByRole('article', { name: 'Sobha Tower – Hebbal' })).getByText('Not started')
    ).toBeInTheDocument();
  });

  it('shows money totals in Indian format', async () => {
    server.use(http.get(API('/dashboard'), () => HttpResponse.json(dashboard)));
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('₹73,655')).toBeInTheDocument();
    expect(screen.getByText('9 workers to pay')).toBeInTheDocument();
    expect(screen.getByText('₹1,500')).toBeInTheDocument();
    expect(screen.getByText('₹62,795')).toBeInTheDocument();
  });

  it('guides a brand-new contractor to add a site', async () => {
    server.use(
      http.get(API('/dashboard'), () =>
        HttpResponse.json({
          ...dashboard,
          sites: [],
          money: { pendingDues: 0, advanceOutstanding: 0, workersWithDues: 0, paidThisWeek: 0 },
          counts: { activeSites: 0, activeWorkers: 0 },
        })
      )
    );
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByRole('link', { name: 'Add your first site' })).toHaveAttribute(
      'href',
      '/sites?new=1'
    );
  });

  it('shows a skeleton while loading', async () => {
    server.use(
      http.get(API('/dashboard'), async () => {
        await delay(200);
        return HttpResponse.json(dashboard);
      })
    );
    renderWithProviders(<DashboardPage />);
    expect(screen.getAllByRole('status', { name: 'Loading' }).length).toBeGreaterThan(0);
    expect(await screen.findByText('₹73,655')).toBeInTheDocument();
  });

  it('shows the error with a retry button', async () => {
    server.use(
      http.get(API('/dashboard'), () =>
        HttpResponse.json({ error: 'Something went wrong' }, { status: 500 })
      )
    );
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
