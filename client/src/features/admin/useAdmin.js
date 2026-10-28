import { useMutation, useQueryClient } from '@tanstack/react-query';
import { refreshAfterSave, useCurrentQuery } from '../../lib/query.js';
import { api } from '../../lib/api.js';

const get = (key, path, query) => ({
  queryKey: ['admin', key, query ?? null],
  queryFn: () => api.get(path, { query }),
});

export const useAdminOverview = () => useCurrentQuery(get('overview', '/admin/overview'));
export const useAdminGrowth = (weeks = 12) =>
  useCurrentQuery(get('growth', '/admin/growth', { weeks }));
export const useDailyActivity = (days = 30) =>
  useCurrentQuery(get('daily', '/admin/activity/daily', { days }));
export const useAdminUsers = (query) => useCurrentQuery({ ...get('users', '/admin/users', query) });
export const useAdminUser = (id) =>
  useCurrentQuery({ ...get('user', `/admin/users/${id}`), enabled: Boolean(id) });
export const useAdminUserWorkers = (id, query) =>
  useCurrentQuery({
    ...get('user-workers', `/admin/users/${id}/workers`, { id, ...query }),
    enabled: Boolean(id),
  });
export const useActivity = (query) =>
  useCurrentQuery({ ...get('activity', '/admin/activity', query) });
export const useAnomalies = () => useCurrentQuery(get('anomalies', '/admin/anomalies'));
export const useKpis = () => useCurrentQuery(get('kpis', '/admin/kpis'));

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, suspend, reason }) =>
      api.post(
        `/admin/users/${id}/${suspend ? 'suspend' : 'reactivate'}`,
        suspend ? { reason } : undefined
      ),
    onSuccess: () => refreshAfterSave(queryClient, ['admin']),
  });
}
