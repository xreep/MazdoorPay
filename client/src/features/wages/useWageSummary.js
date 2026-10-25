import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export const useWageSummary = (query) =>
  useQuery({
    queryKey: ['wages', query],
    queryFn: () => api.get('/wages/summary', { query }),
    placeholderData: keepPreviousData,
  });
