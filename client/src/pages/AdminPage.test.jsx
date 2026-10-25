import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { API, HttpResponse, http, server } from '../test/server.js';
import { admin, renderWithProviders } from '../test/render.jsx';
import { page } from '../test/fixtures.js';
import { RequireRole } from '../auth/guards.jsx';
import { OverviewTab } from '../features/admin/OverviewTab.jsx';
import { UsersTab } from '../features/admin/UsersTab.jsx';
import { ActivityTab } from '../features/admin/ActivityTab.jsx';
import { AccuracyTab } from '../features/admin/AccuracyTab.jsx';
import { AnalyticsTab } from '../features/admin/AnalyticsTab.jsx';

const C1 = '64b7f0c2a1b2c3d4e5f6c001';
const A2 = '64b7f0c2a1b2c3d4e5f6c002';
const users = [
  {
    _id: C1,
    name: 'Ravi Kumar',
    email: 'ravi.kumar@mazdoorpay.in',
    role: 'contractor',
    status: 'active',
    sites: 2,
    workers: 16,
    lastLoginAt: '2026-10-25T03:00:00Z',
  },
  {
    _id: A2,
    name: 'Asha Rao',
    email: 'admin@mazdoorpay.in',
    role: 'admin',
    status: 'active',
    sites: 0,
    workers: 0,
  },
];
const as = (ui, route = '/admin') =>
  renderWithProviders(ui, { user: admin, path: '/admin/*', route });

describe('Admin overview', () => {
  it('shows platform totals and charts', async () => {
    server.use(
      http.get(API('/admin/overview'), () =>
        HttpResponse.json({
          totals: {
            contractors: 2,
            activeContractors: 2,
            suspendedContractors: 0,
            workers: 30,
            activeWorkers: 30,
            sites: 4,
            attendanceRecords: 1350,
            payments: 176,
            totalPaid: 98765400,
          },
          engagement: { active7d: 2, active30d: 2 },
        })
      ),
      http.get(API('/admin/growth'), () =>
        HttpResponse.json({
          weeks: [
            {
              weekStart: '2026-10-19',
              newContractors: 2,
              newWorkers: 30,
              attendanceRecords: 210,
              payments: 25,
            },
          ],
        })
      ),
      http.get(API('/admin/activity/daily'), () =>
        HttpResponse.json({ days: [{ day: '2026-10-25', actions: 40, activeContractors: 2 }] })
      )
    );
    as(<OverviewTab />);
    expect(await screen.findByText('1,350')).toBeInTheDocument();
    expect(screen.getByText('₹9,87,654')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /new contractors/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /actions/i })).toBeInTheDocument();
  });
});

describe('Admin users', () => {
  function handlers(state) {
    return [
      http.get(API('/admin/users'), ({ request }) => {
        state.searches.push(new URL(request.url).searchParams);
        return HttpResponse.json(
          page(
            users.map((u) => (u._id === C1 && state.suspended ? { ...u, status: 'suspended' } : u))
          )
        );
      }),
      http.get(API(`/admin/users/${C1}`), () =>
        HttpResponse.json({
          user: { ...users[0], status: state.suspended ? 'suspended' : 'active' },
          sites: [{ _id: 's1', name: 'Prestige Lakeside – Whitefield', isActive: true }],
          stats: {
            workers: 16,
            activeWorkers: 16,
            attendanceRecords: 720,
            payments: 90,
            totalPaid: 5000000,
            pendingDues: 2666500,
            advanceOutstanding: 0,
          },
        })
      ),
      http.get(API(`/admin/users/${C1}/workers`), () =>
        HttpResponse.json(
          page([
            {
              _id: 'w1',
              name: 'Ramesh Kumar',
              role: 'labourer',
              dailyRate: 65000,
              phone: '98******10',
              upiId: 'ra****@oksbi',
              isActive: true,
              balance: 140000,
            },
          ])
        )
      ),
      http.post(API(`/admin/users/${C1}/suspend`), async ({ request }) => {
        state.suspendBody = await request.json();
        state.suspended = true;
        return HttpResponse.json({ user: { ...users[0], status: 'suspended' } });
      }),
    ];
  }

  it('searches, opens a contractor read-only and suspends with a reason', async () => {
    const state = { searches: [] };
    server.use(...handlers(state));
    as(<UsersTab />, '/admin/users');
    await userEvent.type(
      await screen.findByRole('searchbox', { name: 'Search name or email' }),
      'ravi'
    );
    await waitFor(() => expect(state.searches.at(-1).get('q')).toBe('ravi'));

    expect(
      within(screen.getByRole('article', { name: /Asha Rao/ })).queryByRole('button', {
        name: /Suspend/,
      })
    ).toBeNull();
    await userEvent.click(
      within(screen.getByRole('article', { name: /Ravi Kumar/ })).getByRole('button', {
        name: 'View Ravi Kumar',
      })
    );
    const drawer = await screen.findByRole('dialog', { name: 'Ravi Kumar' });
    expect(await within(drawer).findByText('₹26,665')).toBeInTheDocument();
    expect(await within(drawer).findByText('98******10')).toBeInTheDocument();

    await userEvent.click(within(drawer).getByRole('button', { name: 'Suspend contractor' }));
    const confirm = await screen.findByRole('dialog', { name: 'Suspend Ravi Kumar?' });
    expect(within(confirm).getByRole('button', { name: 'Suspend' })).toBeDisabled();
    await userEvent.type(within(confirm).getByLabelText('Reason'), 'Fake worker entries reported');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Suspend' }));
    await waitFor(() =>
      expect(state.suspendBody).toEqual({ reason: 'Fake worker entries reported' })
    );
    expect(
      await within(screen.getByRole('article', { name: /Ravi Kumar/ })).findByText('Suspended')
    ).toBeInTheDocument();
  });
});

describe('Admin activity', () => {
  it('filters by action and shows who did what', async () => {
    const requests = [];
    server.use(
      http.get(API('/admin/users'), () => HttpResponse.json(page(users))),
      http.get(API('/admin/activity'), ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return HttpResponse.json(
          page([
            {
              _id: 'e1',
              action: 'payment.void',
              entity: 'Payment',
              at: '2026-10-24T09:30:00Z',
              actor: { name: 'Ravi Kumar', role: 'contractor' },
              contractorId: C1,
              after: { voidReason: 'Entered ₹4,500 instead of ₹450' },
            },
          ])
        );
      })
    );
    as(<ActivityTab />, '/admin/activity');
    const log = await screen.findByRole('list', { name: 'Activity log' });
    expect(await within(log).findByText('Ravi Kumar')).toBeInTheDocument();
    expect(within(log).getByText('Voided a payment')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'payment.void');
    await waitFor(() => expect(requests.at(-1).get('action')).toBe('payment.void'));
  });
});

describe('Admin data checks', () => {
  it('says so when nothing is wrong', async () => {
    server.use(
      http.get(API('/admin/anomalies'), () => HttpResponse.json({ counts: {}, anomalies: [] }))
    );
    as(<AccuracyTab />, '/admin/accuracy');
    expect(await screen.findByText('No problems found')).toBeInTheDocument();
  });

  it('groups problems by type with counts', async () => {
    server.use(
      http.get(API('/admin/anomalies'), () =>
        HttpResponse.json({
          counts: { upi_without_reference: 2, worker_without_site: 1 },
          anomalies: [
            {
              type: 'upi_without_reference',
              contractorId: C1,
              detail: 'UPI payment without a 12-digit UTR',
              day: '2026-10-20',
            },
            {
              type: 'upi_without_reference',
              contractorId: C1,
              detail: 'UPI payment without a 12-digit UTR',
              day: '2026-10-21',
            },
            {
              type: 'worker_without_site',
              contractorId: C1,
              detail: 'Raju is active but not assigned to a site',
            },
          ],
        })
      )
    );
    as(<AccuracyTab />, '/admin/accuracy');
    const group = await screen.findByRole('region', { name: /UPI payments without a reference/ });
    expect(within(group).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Raju is active but not assigned to a site')).toBeInTheDocument();
  });
});

describe('Admin analytics', () => {
  it('shows the KPIs and downloads them as CSV', async () => {
    const csv = [];
    server.use(
      http.get(API('/admin/kpis'), ({ request }) => {
        const format = new URL(request.url).searchParams.get('format');
        if (format === 'csv') {
          csv.push(format);
          return new HttpResponse('Metric,Value\r\n', { headers: { 'Content-Type': 'text/csv' } });
        }
        return HttpResponse.json({
          contractors: 2,
          activeContractors7d: 2,
          activeContractors30d: 2,
          engagementRate7d: 100,
          workersManaged: 30,
          attendanceRecords: 1350,
          paymentAccuracyPct: 99.4,
          digitalReferencePct: 100,
        });
      })
    );
    as(<AnalyticsTab />, '/admin/analytics');
    expect(await screen.findByText('99.4%')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Payment tracking accuracy' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Download KPIs (CSV)' }));
    await waitFor(() => expect(csv).toEqual(['csv']));
  });
});

describe('Admin access', () => {
  it('a contractor visiting /admin is sent home', async () => {
    renderWithProviders(
      <RequireRole role="admin">
        <p>Secret</p>
      </RequireRole>,
      { path: '/admin', route: '/admin' }
    );
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
    expect(screen.queryByText('Secret')).toBeNull();
  });
});
