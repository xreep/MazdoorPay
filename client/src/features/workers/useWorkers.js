import { useMutation, useQueryClient } from '@tanstack/react-query';
import { refreshAfterSave, useCurrentQuery } from '../../lib/query.js';
import { api } from '../../lib/api.js';

// What the Workers page asks for when it opens.
export const DEFAULT_WORKER_FILTERS = { q: '', siteId: '', role: '', status: 'active', page: 1 };

export const workersQuery = (filters) => ({
  queryKey: ['workers', filters],
  queryFn: () => api.get('/workers', { query: filters }),
});

export const useWorkers = (filters) => useCurrentQuery({ ...workersQuery(filters) });

export const useWorkerSummary = (id) =>
  useCurrentQuery({
    queryKey: ['worker', id],
    queryFn: () => api.get(`/workers/${id}/summary`),
    enabled: Boolean(id),
  });

function useWorkerMutation(fn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      refreshAfterSave(queryClient, [
        'workers',
        'worker',
        'sites',
        'dashboard',
        'dues',
        'attendance-sheet',
        'wages',
        'wage-slip',
        'worker-cards',
      ]);
    },
  });
}

export const useCreateWorker = () =>
  useWorkerMutation((input) => api.post('/workers', input).then((r) => r.worker));
export const useUpdateWorker = () =>
  useWorkerMutation(({ id, ...changes }) =>
    api.patch(`/workers/${id}`, changes).then((r) => r.worker)
  );
export const useChangeRate = () =>
  useWorkerMutation(({ id, ...input }) => api.post(`/workers/${id}/rate`, input));
export const useSetWorkerActive = () =>
  useWorkerMutation(({ id, active }) =>
    api.post(`/workers/${id}/${active ? 'reactivate' : 'deactivate'}`).then((r) => r.worker)
  );

export const useReplaceCard = () =>
  useWorkerMutation((id) => api.post(`/workers/${id}/card/replace`));

const linkKey = (id) => ['statement-link', id];

export const useStatementLink = (id) =>
  useCurrentQuery({
    queryKey: linkKey(id),
    queryFn: () => api.get(`/workers/${id}/statement-link`),
  });

function useLinkMutation(fn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => refreshAfterSave(queryClient, ['statement-link']),
  });
}

export const useMakeStatementLink = () =>
  useLinkMutation((id) => api.post(`/workers/${id}/statement-link`));
export const useStopStatementLink = () =>
  useLinkMutation((id) => api.del(`/workers/${id}/statement-link`));
