import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { API, HttpResponse, http, server } from '../test/server.js';
import { createQueryClient } from '../lib/queryClient.js';
import { useChangeRate } from './workers/useWorkers.js';
import { useUpdateSite } from './sites/useSites.js';

const setup = (hook) => {
  const client = createQueryClient();
  const spy = vi.spyOn(client, 'invalidateQueries');
  const { result } = renderHook(hook, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  const keys = () => spy.mock.calls.map(([arg]) => arg.queryKey[0]);
  return { result, keys };
};

describe('cache invalidation', () => {
  it('a rate change refreshes wages, dues and the dashboard', async () => {
    server.use(
      http.post(API('/workers/w1/rate'), () => HttpResponse.json({ worker: {}, repricedDays: 2 }))
    );
    const { result, keys } = setup(() => useChangeRate());
    await result.current.mutateAsync({ id: 'w1', dailyRate: 60000 });
    await waitFor(() =>
      expect(keys()).toEqual(expect.arrayContaining(['wages', 'dues', 'dashboard', 'worker']))
    );
  });

  it('renaming a site refreshes every screen that shows site names', async () => {
    server.use(http.patch(API('/sites/s1'), () => HttpResponse.json({ site: {} })));
    const { result, keys } = setup(() => useUpdateSite());
    await result.current.mutateAsync({ id: 's1', name: 'New name' });
    await waitFor(() =>
      expect(keys()).toEqual(
        expect.arrayContaining([
          'sites',
          'workers',
          'dues',
          'attendance-sheet',
          'wages',
          'dashboard',
        ])
      )
    );
  });
});
