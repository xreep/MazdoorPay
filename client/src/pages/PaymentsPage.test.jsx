import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { API, HttpResponse, http, server } from '../test/server.js';
import { renderWithProviders } from '../test/render.jsx';
import { S1, W1, page, sitesResponse, worker } from '../test/fixtures.js';
import PaymentsPage from './PaymentsPage.jsx';

const dues = {
  dues: [
    {
      workerId: W1,
      name: 'Ramesh Kumar',
      role: 'mason',
      siteId: S1,
      siteName: 'Prestige Lakeside – Whitefield',
      earned: 500000,
      paid: 360000,
      balance: 140000,
      isActive: true,
    },
    {
      workerId: 'w2',
      name: 'Raju Das',
      role: 'labourer',
      siteId: S1,
      siteName: 'Prestige Lakeside – Whitefield',
      earned: 100000,
      paid: 50000,
      balance: 50000,
      isActive: true,
    },
  ],
  advances: [
    {
      workerId: 'w3',
      name: 'Kishan Lal',
      role: 'helper',
      siteId: S1,
      siteName: 'Prestige Lakeside – Whitefield',
      earned: 0,
      paid: 30000,
      balance: -30000,
      isActive: true,
    },
  ],
  totals: { pending: 190000, advance: 30000, workersWithDues: 2 },
};

const payment = (overrides = {}) => ({
  _id: 'p1',
  workerId: W1,
  worker: { name: 'Ramesh Kumar', role: 'mason' },
  day: '2026-10-24',
  amount: 45000,
  type: 'wage',
  method: 'upi',
  reference: '412345678901',
  voidedAt: null,
  ...overrides,
});

function handlers({ historyRequests = [], voids = [] } = {}) {
  return [
    http.get(API('/sites'), () => HttpResponse.json(sitesResponse)),
    http.get(API('/payments/dues'), () => HttpResponse.json(dues)),
    http.get(API('/workers'), () => HttpResponse.json(page([worker({ _id: W1 })]))),
    http.get(API('/workers/:id/summary'), () =>
      HttpResponse.json({
        worker: worker({ _id: W1 }),
        site: sitesResponse.sites[0],
        balance: { balance: 140000, earned: 0, paid: 0, paidWage: 0, paidAdvance: 0 },
        recentAttendance: [],
        recentPayments: [],
      })
    ),
    http.get(API('/payments'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      historyRequests.push(params);
      const list =
        params.get('includeVoided') === 'true'
          ? [
              payment(),
              payment({
                _id: 'p2',
                method: 'cash',
                reference: undefined,
                voidedAt: '2026-10-24T10:00:00Z',
                voidReason: 'Duplicate entry',
              }),
            ]
          : [payment()];
      return HttpResponse.json(page(list));
    }),
    http.post(API('/payments/:id/void'), async ({ params, request }) => {
      voids.push({ id: params.id, ...(await request.json()) });
      return HttpResponse.json({
        payment: payment({ voidedAt: '2026-10-25T10:00:00Z' }),
        balance: {},
      });
    }),
  ];
}

const render = (route = '/payments') =>
  renderWithProviders(<PaymentsPage />, { path: '/payments', route });

describe('PaymentsPage', () => {
  // Walkthrough 28 Oct: Payments must load the first time, every time.
  it.each([
    ['', 'Everyone is paid up'],
    ['?tab=advances', 'No advances outstanding'],
    ['?tab=history', 'No payments in this period'],
  ])('loads with nothing recorded yet (tab %s)', async (query, emptyTitle) => {
    server.use(
      http.get(API('/sites'), () => HttpResponse.json({ sites: [] })),
      http.get(API('/workers'), () => HttpResponse.json(page([]))),
      http.get(API('/payments/dues'), () =>
        HttpResponse.json({
          dues: [],
          advances: [],
          totals: { pending: 0, advance: 0, workersWithDues: 0 },
        })
      ),
      http.get(API('/payments'), () => HttpResponse.json(page([])))
    );
    render(`/payments${query}`);
    expect(await screen.findByText(emptyTitle)).toBeInTheDocument();
    expect(screen.queryByText('This screen ran into a problem')).toBeNull();
  });

  it('renders while its data is still loading', async () => {
    const never = () => new Promise(() => {});
    server.use(
      http.get(API('/sites'), never),
      http.get(API('/workers'), never),
      http.get(API('/payments/dues'), never),
      http.get(API('/payments'), never)
    );
    render();
    expect(await screen.findByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    expect(screen.queryByText('This screen ran into a problem')).toBeNull();
  });

  it('lists dues with the total and pays a worker from the list', async () => {
    server.use(...handlers());
    render();
    expect(await screen.findByText('₹1,900 pending for 2 workers')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).getByText('Ramesh Kumar')).toBeInTheDocument();
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Pay Ramesh Kumar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    await waitFor(() => expect(within(dialog).getByLabelText('Worker')).toHaveValue(W1));
  });

  it('advances tab lists outstanding advances', async () => {
    server.use(...handlers());
    render();
    await userEvent.click(await screen.findByRole('tab', { name: /Advances/ }));
    expect(await screen.findByText('Kishan Lal')).toBeInTheDocument();
    expect(screen.getByText('₹300')).toBeInTheDocument();
  });

  it('opens the record form from a link', async () => {
    server.use(...handlers());
    render(`/payments?record=1&workerId=${W1}`);
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    await waitFor(() => expect(within(dialog).getByLabelText('Worker')).toHaveValue(W1));
  });

  it('history filters, shows voided rows on request, and voids with a reason', async () => {
    const historyRequests = [];
    const voids = [];
    server.use(...handlers({ historyRequests, voids }));
    render('/payments?tab=history');
    const first = await screen.findByRole('article', { name: /Ramesh Kumar/ });
    expect(within(first).getByText('UTR 412345678901')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Method'), 'upi');
    await waitFor(() => expect(historyRequests.at(-1).get('method')).toBe('upi'));
    await userEvent.click(screen.getByLabelText('Show voided payments'));
    await waitFor(() => expect(historyRequests.at(-1).get('includeVoided')).toBe('true'));
    expect(await screen.findByText('Duplicate entry')).toBeInTheDocument();

    await userEvent.click(
      within(screen.getAllByRole('article')[0]).getByRole('button', { name: 'Void payment' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Void this payment?' });
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'x');
    expect(within(dialog).getByRole('button', { name: 'Void payment' })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'yz wrong worker');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Void payment' }));
    await waitFor(() => expect(voids).toEqual([{ id: 'p1', reason: 'xyz wrong worker' }]));
    expect(await screen.findByText('Payment voided')).toBeInTheDocument();
  });

  it('each payment links to its printable receipt', async () => {
    server.use(...handlers());
    render('/payments?tab=history');
    const first = await screen.findByRole('article', { name: /Ramesh Kumar/ });
    expect(within(first).getByRole('link', { name: 'Receipt' })).toHaveAttribute(
      'href',
      '/print/receipt/p1'
    );
  });
});
