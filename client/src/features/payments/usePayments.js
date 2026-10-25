import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export const useDues = (siteId) =>
  useQuery({
    queryKey: ['dues', siteId ?? ''],
    queryFn: () => api.get('/payments/dues', { query: { siteId } }),
  });

export const usePaymentHistory = (filters) =>
  useQuery({
    queryKey: ['payments', filters],
    queryFn: () => api.get('/payments', { query: filters }),
    placeholderData: keepPreviousData,
  });

export const usePayment = (id) =>
  useQuery({ queryKey: ['payment', id], queryFn: () => api.get(`/payments/${id}`) });

function usePaymentMutation(fn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ['dues', 'payments', 'payment', 'dashboard', 'worker', 'wages'])
        queryClient.invalidateQueries({ queryKey: [key] });
    },
  });
}

export const useRecordPayment = () => usePaymentMutation((body) => api.post('/payments', body));
export const useVoidPayment = () =>
  usePaymentMutation(({ id, reason }) => api.post(`/payments/${id}/void`, { reason }));
