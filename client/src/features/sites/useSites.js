import { useMutation, useQueryClient } from '@tanstack/react-query';
import { refreshAfterSave, useCurrentQuery } from '../../lib/query.js';
import { api } from '../../lib/api.js';

export const sitesQuery = (status = 'all') => ({
  queryKey: ['sites', status],
  queryFn: () => api.get('/sites', { query: { status } }).then((r) => r.sites),
});

export const useSites = (status = 'all') => useCurrentQuery(sitesQuery(status));

// Active sites as select options, for filters and forms across the app.
export function useSiteOptions() {
  const query = useSites('active');
  return { ...query, options: (query.data ?? []).map((s) => ({ value: s._id, label: s.name })) };
}

function useSiteMutation(fn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      // Site names appear on most screens.
      refreshAfterSave(queryClient, [
        'sites',
        'dashboard',
        'workers',
        'worker',
        'dues',
        'attendance-sheet',
        'wages',
        'wage-slip',
      ]);
    },
  });
}

export const useCreateSite = () =>
  useSiteMutation((input) => api.post('/sites', input).then((r) => r.site));
export const useUpdateSite = () =>
  useSiteMutation(({ id, ...changes }) => api.patch(`/sites/${id}`, changes).then((r) => r.site));
export const useDeleteSite = () => useSiteMutation((id) => api.del(`/sites/${id}`));
