import { describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { refreshAfterSave, useCurrentQuery } from './query.js';

// A query whose answer the test controls: each call returns the next value after `ms`.
function source(values, ms = 50) {
  let i = 0;
  return () =>
    new Promise((resolve) =>
      setTimeout(() => resolve(values[Math.min(i++, values.length - 1)]), ms)
    );
}

function Balance({ queryKey, queryFn }) {
  const { data, isPending } = useCurrentQuery({ queryKey, queryFn });
  return <p>{isPending ? 'Loading' : `Balance ${data}`}</p>;
}

const client = () =>
  new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } });

describe('useCurrentQuery', () => {
  it('never shows data from before this visit while it is being refreshed', async () => {
    const qc = client();
    qc.setQueryData(['wages'], 1050, { updatedAt: Date.now() - 60_000 }); // fetched a minute ago
    const seen = [];
    const Spy = () => {
      const { data, isPending } = useCurrentQuery({ queryKey: ['wages'], queryFn: source([1550]) });
      seen.push(isPending ? 'loading' : data);
      return null;
    };
    render(
      <QueryClientProvider client={qc}>
        <Spy />
      </QueryClientProvider>
    );
    await waitFor(() => expect(seen.at(-1)).toBe(1550));
    expect(seen).not.toContain(1050);
    expect(seen[0]).toBe('loading');
  });

  it('shows data fetched moments ago straight away, with no loading flash', async () => {
    const qc = client();
    qc.setQueryData(['wages'], 1550);
    render(
      <QueryClientProvider client={qc}>
        <Balance queryKey={['wages']} queryFn={source([9999])} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Balance 1550')).toBeInTheDocument();
  });

  it("never shows the previous filter's results as the new one's", async () => {
    const qc = client();
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <Balance queryKey={['workers', 'all']} queryFn={source([4])} />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Balance 4')).toBeInTheDocument();
    rerender(
      <QueryClientProvider client={qc}>
        <Balance queryKey={['workers', 'ramesh']} queryFn={source([1])} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(await screen.findByText('Balance 1')).toBeInTheDocument();
  });
});

describe('refreshAfterSave', () => {
  it('clears the old figures, so the page shows loading and then the new ones', async () => {
    const qc = client();
    const queryFn = source([1050, 1550]);
    render(
      <QueryClientProvider client={qc}>
        <Balance queryKey={['dues']} queryFn={queryFn} />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Balance 1050')).toBeInTheDocument();
    await act(() => {
      refreshAfterSave(qc, ['dues', 'wages']);
    });
    expect(qc.getQueryData(['dues'])).toBeUndefined();
    expect(await screen.findByText('Loading')).toBeInTheDocument();
    expect(await screen.findByText('Balance 1550')).toBeInTheDocument();
  });

  it('leaves nothing old for a page that is not open', async () => {
    const qc = client();
    qc.setQueryData(['wages', { from: '2026-10-26' }], 1050);
    await refreshAfterSave(qc, ['wages']);
    expect(qc.getQueryData(['wages', { from: '2026-10-26' }])).toBeUndefined();
  });
});
