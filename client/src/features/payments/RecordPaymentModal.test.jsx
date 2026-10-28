import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { API, HttpResponse, http, server } from '../../test/server.js';
import { renderWithProviders } from '../../test/render.jsx';
import { S1, W1, page, sitesResponse, worker } from '../../test/fixtures.js';
import { RecordPaymentModal } from './RecordPaymentModal.jsx';

const W2 = '64b7f0c2a1b2c3d4e5f6a002';
const workers = [
  worker({ _id: W1 }),
  worker({ _id: W2, name: 'Kishan Lal', role: 'helper', dailyRate: 55000, upiId: null }),
];
const summary = (id, balance) => ({
  worker: workers.find((w) => w._id === id),
  site: sitesResponse.sites[0],
  balance: {
    earned: 500000,
    paid: 500000 - balance,
    paidWage: 500000 - balance,
    paidAdvance: 0,
    balance,
  },
  recentAttendance: [],
  recentPayments: [],
});

function handlers({ posts = [], respond } = {}) {
  return [
    http.get(API('/workers'), () => HttpResponse.json(page(workers))),
    http.get(API('/workers/:id/summary'), ({ params }) =>
      HttpResponse.json(summary(params.id, params.id === W1 ? 140000 : 0))
    ),
    http.post(API('/payments'), async ({ request }) => {
      const body = await request.json();
      posts.push(body);
      if (respond) return respond(body, posts.length);
      return HttpResponse.json(
        {
          payment: { _id: 'p9', ...body, day: '2026-10-25', voidedAt: null },
          balance: { balance: 0 },
        },
        { status: 201 }
      );
    }),
  ];
}

function Harness({ workerId }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open payment</button>
      {open && <RecordPaymentModal open workerId={workerId} onClose={() => setOpen(false)} />}
    </>
  );
}

const render = (workerId = W1) =>
  renderWithProviders(<Harness workerId={workerId} />, { path: '/payments', route: '/payments' });

describe('RecordPaymentModal', () => {
  it("pre-fills the worker's pending dues", async () => {
    server.use(...handlers());
    render();
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    await waitFor(() => expect(within(dialog).getByLabelText('Amount')).toHaveValue('1400'));
    expect(within(dialog).getByText('Pending: ₹1,400')).toBeInTheDocument();
  });

  it('asks for a worker in plain words when none is chosen', async () => {
    server.use(...handlers());
    renderWithProviders(<Harness />, { path: '/payments', route: '/payments' });
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save payment' }));
    await waitFor(() =>
      expect(within(dialog).getByLabelText('Worker')).toHaveAccessibleDescription('Choose a worker')
    );
    expect(within(dialog).queryByText('Invalid id')).toBeNull();
  });

  it.each([
    ['-100', 'Enter an amount in rupees, like 450 or 450.50'],
    ['0', 'Amount must be more than ₹0'],
    ['', 'Enter an amount'],
  ])('shows one message for the amount "%s"', async (typed, message) => {
    server.use(...handlers());
    render();
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    const amount = within(dialog).getByLabelText('Amount');
    await waitFor(() => expect(amount).toHaveValue('1400'));
    await userEvent.clear(amount);
    if (typed) await userEvent.type(amount, typed);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save payment' }));
    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    const amountMessages = within(dialog)
      .queryAllByText(/^(Enter an amount|Amount must)/)
      .map((el) => el.textContent);
    expect(amountMessages).toEqual([message]);
    expect(amount).toHaveAccessibleDescription(message);
  });

  it('UPI needs a 12-digit UTR; cash has no reference field', async () => {
    const posts = [];
    server.use(...handlers({ posts }));
    render();
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    expect(within(dialog).queryByLabelText(/reference/i)).toBeNull();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'UPI' }));
    await userEvent.type(within(dialog).getByLabelText('UPI reference (UTR)'), '12345');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save payment' }));
    expect(
      await within(dialog).findByText('Enter the 12-digit UPI reference (UTR)')
    ).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  describe('UPI pay-assist', () => {
    const asTouchPhone = (touch) =>
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        matches: touch && query.includes('coarse'),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }));

    it("opens the contractor's UPI app on a phone, with the worker and amount filled in", async () => {
      const spy = asTouchPhone(true);
      server.use(...handlers());
      render();
      const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
      await waitFor(() => expect(within(dialog).getByLabelText('Amount')).toHaveValue('1400'));
      expect(within(dialog).queryByRole('link', { name: /UPI app/ })).toBeNull();
      await userEvent.click(within(dialog).getByRole('radio', { name: 'UPI' }));
      const link = within(dialog).getByRole('link', { name: 'Pay ₹1,400 in your UPI app' });
      const href = link.getAttribute('href');
      expect(href).toMatch(
        /^upi:\/\/pay\?pa=ramesh@oksbi&pn=Ramesh%20Kumar&am=1400\.00&cu=INR&tn=/
      );
      expect(
        within(dialog).getByText(/MazdoorPay cannot see whether the payment went through/)
      ).toBeInTheDocument();

      const amount = within(dialog).getByLabelText('Amount');
      await userEvent.clear(amount);
      await userEvent.type(amount, '500');
      expect(
        within(dialog).getByRole('link', { name: 'Pay ₹500 in your UPI app' }).getAttribute('href')
      ).toMatch('am=500.00');
      spy.mockRestore();
    });

    it('shows a QR code to scan with a phone on a computer', async () => {
      const spy = asTouchPhone(false);
      server.use(...handlers());
      render();
      const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
      await waitFor(() => expect(within(dialog).getByLabelText('Amount')).toHaveValue('1400'));
      await userEvent.click(within(dialog).getByRole('radio', { name: 'UPI' }));
      expect(
        await within(dialog).findByRole('img', { name: 'UPI QR code: pay ₹1,400 to ramesh@oksbi' })
      ).toBeInTheDocument();
      spy.mockRestore();
    });

    it('explains what is missing when the worker has no UPI ID', async () => {
      server.use(...handlers());
      render(W2);
      const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
      await userEvent.click(within(dialog).getByRole('radio', { name: 'UPI' }));
      const warning = await within(dialog).findByRole('alert');
      expect(warning).toHaveTextContent('Kishan Lal has no UPI ID on file');
      expect(
        within(warning).getByRole('link', { name: "Add Kishan Lal's UPI ID" })
      ).toHaveAttribute('href', `/workers/${W2}`);
      expect(within(dialog).queryByRole('img', { name: /UPI QR code/ })).toBeNull();
    });
  });

  it('offers to record the extra as an advance when above dues', async () => {
    const posts = [];
    server.use(
      ...handlers({
        posts,
        respond: (body) =>
          body.type === 'wage'
            ? HttpResponse.json(
                {
                  error:
                    'Amount is more than pending dues (₹1,400). Record the extra as an advance.',
                  details: [{ path: 'amount', message: 'Pending dues are ₹1,400' }],
                },
                { status: 400 }
              )
            : HttpResponse.json(
                { payment: { _id: 'p9', ...body, voidedAt: null }, balance: {} },
                { status: 201 }
              ),
      })
    );
    render();
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    const amount = within(dialog).getByLabelText('Amount');
    await waitFor(() => expect(amount).toHaveValue('1400'));
    await userEvent.clear(amount);
    await userEvent.type(amount, '2000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save payment' }));
    expect(
      await within(dialog).findByText(
        'Amount is more than pending dues (₹1,400). Record the extra as an advance.'
      )
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Record ₹2,000 as an advance instead' })
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save payment' }));
    await waitFor(() => expect(posts.at(-1)).toMatchObject({ type: 'advance', amount: 200000 }));
  });

  it('a double tap sends the same key; reopening uses a new one (Review Focus 2)', async () => {
    const posts = [];
    server.use(...handlers({ posts }));
    render();
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    await waitFor(() => expect(within(dialog).getByLabelText('Amount')).toHaveValue('1400'));
    await userEvent.dblClick(within(dialog).getByRole('button', { name: 'Save payment' }));
    await waitFor(() => expect(posts.length).toBeGreaterThan(0));
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ workerId: W1, amount: 140000, type: 'wage', method: 'cash' });
    // sonner keeps toasts in a module-level store, so earlier tests' toasts can linger.
    expect((await screen.findAllByText('Payment saved')).length).toBeGreaterThan(0);
    const firstKey = posts[0].idempotencyKey;
    await userEvent.click(screen.getByRole('button', { name: 'Open payment' }));
    const again = await screen.findByRole('dialog', { name: 'Record payment' });
    await waitFor(() => expect(within(again).getByLabelText('Amount')).toHaveValue('1400'));
    await userEvent.click(within(again).getByRole('button', { name: 'Save payment' }));
    await waitFor(() => expect(posts.at(-1).idempotencyKey).not.toBe(firstKey));
  });

  it('after a lost response it warns that the payment may already be saved', async () => {
    server.use(
      ...handlers({
        respond: (_body, n) =>
          n === 1
            ? HttpResponse.error()
            : HttpResponse.json(
                { error: 'This request key was already used for a different payment' },
                { status: 409 }
              ),
      })
    );
    render();
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    await waitFor(() => expect(within(dialog).getByLabelText('Amount')).toHaveValue('1400'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save payment' }));
    expect(await within(dialog).findByText(/may already be saved/)).toBeInTheDocument();
    const amount = within(dialog).getByLabelText('Amount');
    await userEvent.clear(amount);
    await userEvent.type(amount, '1300');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save payment' }));
    expect(await within(dialog).findByText(/may already be saved/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/request key/)).toBeNull();
    expect(within(dialog).getByRole('link', { name: 'Check payment history' })).toHaveAttribute(
      'href',
      `/payments?tab=history&workerId=${W1}`
    );
  });

  it('lets you choose the worker when none was given', async () => {
    server.use(...handlers());
    render(null);
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    await within(dialog).findByRole('option', { name: 'Kishan Lal' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Worker'), W2);
    expect(await within(dialog).findByText('Nothing pending')).toBeInTheDocument();
    expect(S1).toBeTruthy();
    vi.restoreAllMocks();
  });
});
