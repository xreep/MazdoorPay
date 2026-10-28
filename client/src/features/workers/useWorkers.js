import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

// What the Workers page asks for when it opens.
export const DEFAULT_WORKER_FILTERS = { q: '', siteId: '', role: '', status: 'active', page: 1 };

export const workersQuery = (filters) => ({
  queryKey: ['workers', filters],
  queryFn: () => api.get('/workers', { query: filters }),
});

export const useWorkers = (filters) =>
  useQuery({ ...workersQuery(filters), placeholderData: keepPreviousData });

export const useWorkerSummary = (id) =>
  useQuery({
    queryKey: ['worker', id],
    queryFn: () => api.get(`/workers/${id}/summary`),
    enabled: Boolean(id),
  });

function useWorkerMutation(fn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of [
        'workers',
        'worker',
        'sites',
        'dashboard',
        'dues',
        'attendance-sheet',
        'wages',
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
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
  useQuery({ queryKey: linkKey(id), queryFn: () => api.get(`/workers/${id}/statement-link`) });

function useLinkMutation(fn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_result, id) => queryClient.invalidateQueries({ queryKey: linkKey(id) }),
  });
}

export const useMakeStatementLink = () =>
  useLinkMutation((id) => api.post(`/workers/${id}/statement-link`));
export const useStopStatementLink = () =>
  useLinkMutation((id) => api.del(`/workers/${id}/statement-link`));
