import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export const wageSummaryQuery = (query) => ({
  queryKey: ['wages', query],
  queryFn: () => api.get('/wages/summary', { query }),
});

export const useWageSummary = (query) =>
  useQuery({ ...wageSummaryQuery(query), placeholderData: keepPreviousData });
