import { useCurrentQuery } from '../../lib/query.js';
import { api } from '../../lib/api.js';

export const wageSummaryQuery = (query) => ({
  queryKey: ['wages', query],
  queryFn: () => api.get('/wages/summary', { query }),
});

export const useWageSummary = (query) => useCurrentQuery({ ...wageSummaryQuery(query) });
