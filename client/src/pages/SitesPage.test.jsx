import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { API, HttpResponse, http, server } from '../test/server.js';
import { renderWithProviders } from '../test/render.jsx';
import { sitesResponse } from '../test/fixtures.js';
import SitesPage from './SitesPage.jsx';

const sites = [
  {
    _id: 's1',
    name: 'Prestige Lakeside – Whitefield',
    location: 'Varthur Road, Bengaluru',
    isActive: true,
    activeWorkers: 8,
    totalWorkers: 9,
  },
  {
    _id: 's2',
    name: 'Old Godown',
    location: '',
    isActive: false,
    activeWorkers: 0,
    totalWorkers: 0,
  },
];

const listHandler = (list = sites) =>
  http.get(API('/sites'), () => HttpResponse.json({ sites: list }));
const card = (name) => screen.getByRole('article', { name });

describe('SitesPage', () => {
  it("labels the worker count as a link to the site's worker list", async () => {
    server.use(http.get(API('/sites'), () => HttpResponse.json(sitesResponse)));
    renderWithProviders(<SitesPage />, { path: '/sites', route: '/sites' });
    const site = sitesResponse.sites[0];
    // Visible: the counts and "View list"; screen readers also hear which site.
    await waitFor(() => expect(screen.getAllByRole('link').length).toBeGreaterThan(1));
    const link = await screen.findByRole('link', {
      name: `${site.activeWorkers} active of ${site.totalWorkers} workers · View list for ${site.name}`,
    });
    expect(link).toHaveAttribute('href', `/workers?siteId=${site._id}`);
  });

  it('lists active then inactive sites with counts', async () => {
    server.use(listHandler());
    renderWithProviders(<SitesPage />, { path: '/sites', route: '/sites' });
    expect(await screen.findByText('8 active of 9 workers')).toBeInTheDocument();
    const articles = screen.getAllByRole('article');
    expect(articles.map((a) => within(a).getByRole('heading').textContent)).toEqual([
      'Prestige Lakeside – Whitefield',
      'Old Godown',
    ]);
    expect(within(card('Old Godown')).getByText('Inactive')).toBeInTheDocument();
  });

  it('creates a site after validating the name', async () => {
    let body;
    server.use(
      listHandler([]),
      http.post(API('/sites'), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ site: { _id: 's9', ...body, isActive: true } }, { status: 201 });
      })
    );
    renderWithProviders(<SitesPage />, { path: '/sites', route: '/sites?new=1' });
    const dialog = await screen.findByRole('dialog', { name: 'Add site' });
    await userEvent.type(within(dialog).getByLabelText('Site name'), 'X');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add site' }));
    expect(
      await within(dialog).findByText('Site name must be at least 2 characters')
    ).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Site name'), 'ylo Heights');
    await userEvent.type(
      within(dialog).getByLabelText('Address or area (optional)'),
      'Baner, Pune'
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add site' }));
    await waitFor(() => expect(body).toEqual({ name: 'Xylo Heights', location: 'Baner, Pune' }));
    expect(await screen.findByText('Site added')).toBeInTheDocument();
  });

  it("shows the server's duplicate-name message under the name", async () => {
    server.use(
      listHandler(),
      http.post(API('/sites'), () =>
        HttpResponse.json(
          {
            error: 'You already have a site with this name',
            details: [{ path: 'name', message: 'Already used' }],
          },
          { status: 409 }
        )
      )
    );
    renderWithProviders(<SitesPage />, { path: '/sites', route: '/sites?new=1' });
    const dialog = await screen.findByRole('dialog', { name: 'Add site' });
    await userEvent.type(
      within(dialog).getByLabelText('Site name'),
      'Prestige Lakeside – Whitefield'
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add site' }));
    expect(
      await within(dialog).findByText('You already have a site with this name')
    ).toBeInTheDocument();
  });

  it('delete asks first and explains when the site is in use', async () => {
    server.use(
      listHandler(),
      http.delete(API('/sites/s1'), () =>
        HttpResponse.json(
          { error: 'This site has workers or records. Mark it inactive instead.' },
          { status: 409 }
        )
      )
    );
    renderWithProviders(<SitesPage />, { path: '/sites', route: '/sites' });
    await screen.findByText('8 active of 9 workers');
    await userEvent.click(
      within(card('Prestige Lakeside – Whitefield')).getByRole('button', { name: 'Delete site' })
    );
    const confirm = await screen.findByRole('dialog', {
      name: 'Delete Prestige Lakeside – Whitefield?',
    });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete site' }));
    expect(
      await screen.findByText('This site has workers or records. Mark it inactive instead.')
    ).toBeInTheDocument();
  });

  it('marks a site inactive', async () => {
    let patch;
    server.use(
      listHandler(),
      http.patch(API('/sites/s1'), async ({ request }) => {
        patch = await request.json();
        return HttpResponse.json({ site: { ...sites[0], ...patch } });
      })
    );
    renderWithProviders(<SitesPage />, { path: '/sites', route: '/sites' });
    await screen.findByText('8 active of 9 workers');
    await userEvent.click(
      within(card('Prestige Lakeside – Whitefield')).getByRole('button', { name: 'Mark inactive' })
    );
    await waitFor(() => expect(patch).toEqual({ isActive: false }));
  });

  it('shows an empty state with the next action', async () => {
    server.use(listHandler([]));
    renderWithProviders(<SitesPage />, { path: '/sites', route: '/sites' });
    expect(await screen.findByText('No sites yet')).toBeInTheDocument();
  });
});
