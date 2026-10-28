import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { hashKey } from '@tanstack/react-query';
import { API, HttpResponse, http, server } from '../test/server.js';
import { renderWithProviders } from '../test/render.jsx';
import { page, sitesResponse } from '../test/fixtures.js';
import { contractorStartQueries } from './warmUp.js';
import WorkersPage from '../pages/WorkersPage.jsx';
import WagesPage from '../pages/WagesPage.jsx';
import PaymentsPage from '../pages/PaymentsPage.jsx';

// The background warm-up only helps if it stores data under the exact keys the pages read.
const warmed = new Set(contractorStartQueries().map((q) => hashKey(q.queryKey)));

const api = () =>
  server.use(
    http.get(API('/sites'), () => HttpResponse.json(sitesResponse)),
    http.get(API('/workers'), () => HttpResponse.json(page([]))),
    http.get(API('/payments/dues'), () =>
      HttpResponse.json({
        dues: [],
        advances: [],
        totals: { pending: 0, advance: 0, workersWithDues: 0 },
      })
    ),
    http.get(API('/wages/summary'), () =>
      HttpResponse.json({ from: '', to: '', groupBy: 'week', buckets: [], workers: [], totals: {} })
    )
  );

describe('background warm-up', () => {
  it.each([
    ['Workers', WorkersPage, '/workers', 'workers'],
    ['Wages', WagesPage, '/wages', 'wages'],
    ['Payments', PaymentsPage, '/payments', 'dues'],
  ])('fetches what the %s page asks for when it opens', async (_name, Page, path, key) => {
    api();
    const { queryClient } = renderWithProviders(<Page />, { path, route: path });
    await waitFor(() =>
      expect(queryClient.getQueryCache().findAll({ queryKey: [key] }).length).toBeGreaterThan(0)
    );
    const asked = queryClient
      .getQueryCache()
      .findAll({ queryKey: [key] })
      .map((q) => q.queryHash);
    expect(asked.some((hash) => warmed.has(hash))).toBe(true);
  });
});
