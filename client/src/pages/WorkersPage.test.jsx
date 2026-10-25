import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { todayIST } from '@mazdoorpay/shared';
import { API, HttpResponse, http, server } from '../test/server.js';
import { renderWithProviders } from '../test/render.jsx';
import { S1, S2, page, sitesResponse, worker } from '../test/fixtures.js';
import WorkersPage from './WorkersPage.jsx';

const render = (route = '/workers') =>
  renderWithProviders(<WorkersPage />, { path: '/workers', route });

function listHandler(
  searches,
  list = [
    worker(),
    worker({ _id: 'w2', name: 'Suresh Mehta', role: 'helper', dailyRate: 55000, siteId: S2 }),
  ]
) {
  return http.get(API('/workers'), ({ request }) => {
    searches.push(new URL(request.url).searchParams);
    return HttpResponse.json(page(list));
  });
}

describe('WorkersPage', () => {
  it('shows each worker with role, site and daily rate, linking to the profile', async () => {
    server.use(
      http.get(API('/sites'), () => HttpResponse.json(sitesResponse)),
      listHandler([])
    );
    render();
    const row = await screen.findByRole('link', { name: /Ramesh Kumar/ });
    expect(row).toHaveAttribute('href', '/workers/w1');
    expect(within(row).getByText('Mason')).toBeInTheDocument();
    expect(within(row).getByText('Prestige Lakeside – Whitefield')).toBeInTheDocument();
    expect(within(row).getByText('₹950')).toBeInTheDocument();
  });

  it('debounces search and sends filters', async () => {
    const searches = [];
    server.use(
      http.get(API('/sites'), () => HttpResponse.json(sitesResponse)),
      listHandler(searches)
    );
    render();
    await screen.findByRole('link', { name: /Ramesh Kumar/ });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search by name or phone' }), 'ram');
    await waitFor(() => expect(searches.at(-1).get('q')).toBe('ram'));
    expect(searches.some((s) => s.get('q') === 'r')).toBe(false);
    await userEvent.selectOptions(screen.getByLabelText('Site'), S2);
    await waitFor(() => expect(searches.at(-1).get('siteId')).toBe(S2));
    await userEvent.click(screen.getByRole('radio', { name: 'Inactive' }));
    await waitFor(() => expect(searches.at(-1).get('status')).toBe('inactive'));
  });

  it('shows an empty state with the next action', async () => {
    server.use(
      http.get(API('/sites'), () => HttpResponse.json(sitesResponse)),
      listHandler([], [])
    );
    render();
    expect(await screen.findByText('No workers yet')).toBeInTheDocument();
  });
});

describe('WorkerForm', () => {
  it('sends the rate in paise, validates phone and limits the joining date to today (IST)', async () => {
    let body;
    server.use(
      http.get(API('/sites'), () => HttpResponse.json(sitesResponse)),
      listHandler([], []),
      http.post(API('/workers'), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ worker: worker({ ...body, _id: 'w9' }) }, { status: 201 });
      })
    );
    render('/workers?new=1');
    const dialog = await screen.findByRole('dialog', { name: 'Add worker' });
    expect(within(dialog).getByLabelText('Joining date')).toHaveAttribute('max', todayIST());
    await userEvent.type(within(dialog).getByLabelText('Full name'), 'Abdul Karim');
    await userEvent.selectOptions(within(dialog).getByLabelText('Work'), 'welder');
    await userEvent.type(within(dialog).getByLabelText('Daily wage'), '1020');
    await userEvent.selectOptions(within(dialog).getByLabelText('Site'), S1);
    await userEvent.type(within(dialog).getByLabelText('Mobile number (optional)'), '12345');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add worker' }));
    expect(
      await within(dialog).findByText('Enter a 10-digit Indian mobile number')
    ).toBeInTheDocument();
    await userEvent.clear(within(dialog).getByLabelText('Mobile number (optional)'));
    await userEvent.type(within(dialog).getByLabelText('Mobile number (optional)'), '9876501234');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add worker' }));
    await waitFor(() =>
      expect(body).toMatchObject({
        name: 'Abdul Karim',
        role: 'welder',
        dailyRate: 102000,
        siteId: S1,
        phone: '9876501234',
      })
    );
    expect(await screen.findByText('Abdul Karim added')).toBeInTheDocument();
  });
});
