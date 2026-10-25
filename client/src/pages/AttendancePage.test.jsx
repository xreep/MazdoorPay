import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays, todayIST } from '@mazdoorpay/shared';
import { API, HttpResponse, http, server } from '../test/server.js';
import { renderWithProviders } from '../test/render.jsx';
import { S1, S2, sitesResponse } from '../test/fixtures.js';
import AttendancePage from './AttendancePage.jsx';

const W = ['64b7f0c2a1b2c3d4e5f6a001', '64b7f0c2a1b2c3d4e5f6a002', '64b7f0c2a1b2c3d4e5f6a003'];
const sheetFor = (day, siteId = S1) => ({
  day,
  site: sitesResponse.sites.find((s) => s._id === siteId),
  workers: [
    {
      workerId: W[0],
      name: 'Ramesh Kumar',
      role: 'mason',
      rate: 95000,
      status: 'present',
      method: 'manual',
      isActive: true,
    },
    {
      workerId: W[1],
      name: 'Suresh Mehta',
      role: 'labourer',
      rate: 62000,
      status: null,
      method: null,
      isActive: true,
    },
    {
      workerId: W[2],
      name: 'Vijay Patel',
      role: 'mason',
      rate: 95000,
      status: null,
      method: null,
      isActive: true,
    },
  ],
  summary: { total: 3, marked: 1, present: 1, halfDay: 0, absent: 0 },
});

function handlers({ sheetRequests = [], puts = [], putResponse } = {}) {
  return [
    http.get(API('/sites'), () => HttpResponse.json(sitesResponse)),
    http.get(API('/attendance/sheet'), ({ request }) => {
      const url = new URL(request.url);
      sheetRequests.push(url.searchParams);
      return HttpResponse.json(
        sheetFor(url.searchParams.get('day'), url.searchParams.get('siteId'))
      );
    }),
    http.put(API('/attendance'), async ({ request }) => {
      const body = await request.json();
      puts.push(body);
      return HttpResponse.json(
        putResponse ?? { saved: body.records.length, unchanged: 0, errors: [] }
      );
    }),
    http.get(API('/attendance/calendar'), ({ request }) => {
      const month = new URL(request.url).searchParams.get('month');
      return HttpResponse.json({
        month,
        days: [{ day: `${month}-01`, present: 12, halfDay: 1, absent: 3, marked: 16 }],
      });
    }),
  ];
}

const row = (name) => screen.getByRole('group', { name });
const render = (route = `/attendance?siteId=${S1}`) =>
  renderWithProviders(<AttendancePage />, {
    path: '/attendance',
    route,
    extraRoutes: [{ path: '/workers', element: <p>Workers page</p> }],
  });

afterEach(() => vi.useRealTimers());

describe('AttendancePage', () => {
  it("offers card scanning for today and the site's ID cards to print", async () => {
    server.use(...handlers());
    render();
    await screen.findByRole('group', { name: 'Ramesh Kumar' });
    expect(screen.getByRole('button', { name: 'Scan ID cards' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Print ID cards' })).toHaveAttribute(
      'href',
      `/print/cards?siteId=${S1}`
    );
  });

  it('does not offer scanning on a past day, since a scan marks today', async () => {
    server.use(...handlers());
    render(`/attendance?siteId=${S1}&day=${addDays(todayIST(), -1)}`);
    await screen.findByRole('group', { name: 'Ramesh Kumar' });
    expect(screen.queryByRole('button', { name: 'Scan ID cards' })).toBeNull();
  });

  it('opens on the IST day even when UTC is still yesterday (Review Focus 5)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-24T19:00:00Z'));
    const sheetRequests = [];
    server.use(...handlers({ sheetRequests }));
    render();
    await screen.findByRole('group', { name: 'Ramesh Kumar' });
    expect(sheetRequests[0].get('day')).toBe('2026-10-25');
    expect(screen.getByLabelText('Day')).toHaveAttribute('max', '2026-10-25');
  });

  it('one tap marks a worker; the save bar counts changes and saves only them', async () => {
    const puts = [];
    server.use(...handlers({ puts }));
    render();
    await screen.findByRole('group', { name: 'Ramesh Kumar' });
    expect(within(row('Ramesh Kumar')).getByRole('button', { name: 'Present' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await userEvent.click(within(row('Suresh Mehta')).getByRole('button', { name: 'Half-day' }));
    await userEvent.click(within(row('Vijay Patel')).getByRole('button', { name: 'Absent' }));
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save attendance' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({
      day: todayIST(),
      records: [
        { workerId: W[1], status: 'half-day' },
        { workerId: W[2], status: 'absent' },
      ],
    });
    expect(await screen.findByText('Attendance saved for 2 workers')).toBeInTheDocument();
  });

  it('keeps a tap made while the save is still in flight', async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    server.use(
      http.put(API('/attendance'), async ({ request }) => {
        const body = await request.json();
        await gate;
        return HttpResponse.json({ saved: body.records.length, unchanged: 0, errors: [] });
      }),
      ...handlers()
    );
    render();
    await screen.findByRole('group', { name: 'Ramesh Kumar' });
    await userEvent.click(within(row('Suresh Mehta')).getByRole('button', { name: 'Half-day' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save attendance' }));
    await userEvent.click(within(row('Vijay Patel')).getByRole('button', { name: 'Absent' }));
    release();
    expect(await screen.findByText('Attendance saved for 1 worker')).toBeInTheDocument();
    expect(within(row('Vijay Patel')).getByRole('button', { name: 'Absent' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument();
  });

  it('mark all present and undo', async () => {
    server.use(...handlers());
    render();
    await screen.findByRole('group', { name: 'Ramesh Kumar' });
    await userEvent.click(screen.getByRole('button', { name: 'Mark all present' }));
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.queryByText(/unsaved change/)).toBeNull());
  });

  it('asks for a reason before changing a day more than 7 days back', async () => {
    const puts = [];
    server.use(...handlers({ puts }));
    const old = addDays(todayIST(), -9);
    render(`/attendance?siteId=${S1}&day=${old}`);
    await screen.findByRole('group', { name: 'Ramesh Kumar' });
    await userEvent.click(within(row('Suresh Mehta')).getByRole('button', { name: 'Present' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save attendance' }));
    const dialog = await screen.findByRole('dialog', { name: 'Why are you changing an old day?' });
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Copied from paper register');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save attendance' }));
    await waitFor(() =>
      expect(puts[0]).toMatchObject({ day: old, reason: 'Copied from paper register' })
    );
  });

  it('shows per-worker errors from the server and keeps those changes', async () => {
    server.use(
      ...handlers({
        putResponse: {
          saved: 1,
          unchanged: 0,
          errors: [{ workerId: W[2], error: 'Worker had not joined on this day' }],
        },
      })
    );
    render();
    await screen.findByRole('group', { name: 'Ramesh Kumar' });
    await userEvent.click(within(row('Suresh Mehta')).getByRole('button', { name: 'Present' }));
    await userEvent.click(within(row('Vijay Patel')).getByRole('button', { name: 'Present' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save attendance' }));
    expect(
      await within(row('Vijay Patel')).findByText('Worker had not joined on this day')
    ).toBeInTheDocument();
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument();
  });

  it('asks before discarding unsaved changes when switching site (Review Focus 3)', async () => {
    const sheetRequests = [];
    server.use(...handlers({ sheetRequests }));
    render();
    await screen.findByRole('group', { name: 'Ramesh Kumar' });
    await userEvent.click(within(row('Suresh Mehta')).getByRole('button', { name: 'Absent' }));
    await userEvent.selectOptions(screen.getByLabelText('Site'), S2);
    const dialog = await screen.findByRole('dialog', { name: 'Discard 1 unsaved change?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Site')).toHaveValue(S1);
    await userEvent.selectOptions(screen.getByLabelText('Site'), S2);
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard' })
    );
    await waitFor(() => expect(sheetRequests.at(-1).get('siteId')).toBe(S2));
  });

  it('asks before leaving the page with unsaved changes', async () => {
    server.use(...handlers());
    const { router } = render();
    await screen.findByRole('group', { name: 'Ramesh Kumar' });
    await userEvent.click(within(row('Suresh Mehta')).getByRole('button', { name: 'Absent' }));
    router.navigate('/workers');
    expect(
      await screen.findByRole('dialog', { name: 'Discard 1 unsaved change?' })
    ).toBeInTheDocument();
  });

  it('calendar tab shows counts per day', async () => {
    server.use(...handlers());
    render();
    await userEvent.click(await screen.findByRole('tab', { name: 'Calendar' }));
    const month = todayIST().slice(0, 7);
    expect(
      await screen.findByRole('button', {
        name: new RegExp(`^1 .*: 12 present, 1 half-day, 3 absent`),
      })
    ).toBeInTheDocument();
    expect(month).toBeTruthy();
  });

  it('muster roll CSV downloads with the chosen month and site', async () => {
    const requests = [];
    server.use(
      ...handlers(),
      http.get(API('/reports/muster-roll'), ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return new HttpResponse('Name,Role\r\n', { headers: { 'Content-Type': 'text/csv' } });
      })
    );
    render();
    await userEvent.click(await screen.findByRole('tab', { name: 'Reports' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Download muster roll (CSV)' })
    );
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].get('format')).toBe('csv');
    expect(requests[0].get('siteId')).toBe(S1);
    expect(requests[0].get('month')).toBe(todayIST().slice(0, 7));
  });
});
