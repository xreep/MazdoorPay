import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

const get = (key, path, query) => ({
  queryKey: ['admin', key, query ?? null],
  queryFn: () => api.get(path, { query }),
});

export const useAdminOverview = () => useQuery(get('overview', '/admin/overview'));
export const useAdminGrowth = (weeks = 12) => useQuery(get('growth', '/admin/growth', { weeks }));
export const useDailyActivity = (days = 30) =>
  useQuery(get('daily', '/admin/activity/daily', { days }));
export const useAdminUsers = (query) =>
  useQuery({ ...get('users', '/admin/users', query), placeholderData: keepPreviousData });
export const useAdminUser = (id) =>
  useQuery({ ...get('user', `/admin/users/${id}`), enabled: Boolean(id) });
export const useAdminUserWorkers = (id, query) =>
  useQuery({
    ...get('user-workers', `/admin/users/${id}/workers`, { id, ...query }),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });
export const useActivity = (query) =>
  useQuery({ ...get('activity', '/admin/activity', query), placeholderData: keepPreviousData });
export const useAnomalies = () => useQuery(get('anomalies', '/admin/anomalies'));
export const useKpis = () => useQuery(get('kpis', '/admin/kpis'));

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, suspend, reason }) =>
      api.post(
        `/admin/users/${id}/${suspend ? 'suspend' : 'reactivate'}`,
        suspend ? { reason } : undefined
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}
