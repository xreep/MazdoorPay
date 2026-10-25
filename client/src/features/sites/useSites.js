import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export const useSites = (status = 'all') =>
  useQuery({
    queryKey: ['sites', status],
    queryFn: () => api.get('/sites', { query: { status } }).then((r) => r.sites),
  });

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
      for (const key of [
        'sites',
        'dashboard',
        'workers',
        'worker',
        'dues',
        'attendance-sheet',
        'wages',
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export const useCreateSite = () =>
  useSiteMutation((input) => api.post('/sites', input).then((r) => r.site));
export const useUpdateSite = () =>
  useSiteMutation(({ id, ...changes }) => api.patch(`/sites/${id}`, changes).then((r) => r.site));
export const useDeleteSite = () => useSiteMutation((id) => api.del(`/sites/${id}`));
