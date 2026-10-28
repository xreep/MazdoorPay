import { useMutation, useQueryClient } from '@tanstack/react-query';
import { refreshAfterSave, useCurrentQuery } from '../../lib/query.js';
import { api } from '../../lib/api.js';

export const duesQuery = (siteId) => ({
  queryKey: ['dues', siteId ?? ''],
  queryFn: () => api.get('/payments/dues', { query: { siteId } }),
});

// Changing the site filter keeps the current list on screen until the new one arrives.
export const useDues = (siteId) => useCurrentQuery({ ...duesQuery(siteId) });

export const usePaymentHistory = (filters) =>
  useCurrentQuery({
    queryKey: ['payments', filters],
    queryFn: () => api.get('/payments', { query: filters }),
  });

export const usePayment = (id) =>
  useCurrentQuery({ queryKey: ['payment', id], queryFn: () => api.get(`/payments/${id}`) });

function usePaymentMutation(fn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      refreshAfterSave(queryClient, [
        'dues',
        'payments',
        'payment',
        'dashboard',
        'worker',
        'wages',
        'wage-slip',
      ]),
  });
}

export const useRecordPayment = () => usePaymentMutation((body) => api.post('/payments', body));
export const useVoidPayment = () =>
  usePaymentMutation(({ id, reason }) => api.post(`/payments/${id}/void`, { reason }));
