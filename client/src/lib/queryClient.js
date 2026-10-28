import { QueryClient } from '@tanstack/react-query';

// Client errors (4xx) are answers, not glitches: never retry them.
const retry = (failureCount, error) =>
  !(error?.status >= 400 && error?.status < 500) && failureCount < 2;

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      // Pages revisited within 30 minutes show their last data at once, then refresh quietly.
      queries: { staleTime: 30_000, gcTime: 30 * 60_000, retry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
