import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export const useWorkers = (filters) =>
  useQuery({
    queryKey: ['workers', filters],
    queryFn: () => api.get('/workers', { query: filters }),
    placeholderData: keepPreviousData,
  });

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
