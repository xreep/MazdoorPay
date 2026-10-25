import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { API, HttpResponse, http, server } from '../../test/server.js';
import { renderWithProviders } from '../../test/render.jsx';
import IdCardsPrint from './IdCardsPrint.jsx';

const cards = {
  contractor: { name: 'Ravi Kumar', phone: '9800000001' },
  cards: [
    {
      worker: { _id: 'w1', name: 'Ramesh Yadav', role: 'mason' },
      site: { name: 'Prestige Lakeside' },
      code: 'MP1.64b7f0c2a1b2c3d4e5f6a001.1.abcdefghijklmnop',
    },
    {
      worker: { _id: 'w2', name: 'Suresh Patil', role: 'helper' },
      site: { name: 'Prestige Lakeside' },
      code: 'MP1.64b7f0c2a1b2c3d4e5f6a002.1.abcdefghijklmnop',
    },
  ],
};

describe('IdCardsPrint', () => {
  it('prints one card with a QR code per worker for the site', async () => {
    let query;
    server.use(
      http.get(API('/workers/cards'), ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json(cards);
      })
    );
    renderWithProviders(<IdCardsPrint />, {
      path: '/print/cards',
      route: '/print/cards?siteId=s1',
    });
    const list = await screen.findByRole('list', { name: 'ID cards' });
    expect(query.get('siteId')).toBe('s1');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Ramesh Yadav')).toBeInTheDocument();
    expect(within(items[0]).getByText('Mason · Prestige Lakeside')).toBeInTheDocument();
    expect(
      await within(items[0]).findByRole('img', { name: 'QR code for Ramesh Yadav' })
    ).toBeInTheDocument();
  });

  it('says so when the site has no active workers', async () => {
    server.use(http.get(API('/workers/cards'), () => HttpResponse.json({ ...cards, cards: [] })));
    renderWithProviders(<IdCardsPrint />, {
      path: '/print/cards',
      route: '/print/cards?siteId=s1',
    });
    expect(await screen.findByText('No active workers on this site.')).toBeInTheDocument();
  });
});
