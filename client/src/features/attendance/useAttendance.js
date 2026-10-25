import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export const sheetKey = (siteId, day) => ['attendance-sheet', siteId, day];

export const useAttendanceSheet = (siteId, day) =>
  useQuery({
    queryKey: sheetKey(siteId, day),
    queryFn: () => api.get('/attendance/sheet', { query: { siteId, day } }),
    enabled: Boolean(siteId && day),
  });

export const useAttendanceCalendar = (siteId, month) =>
  useQuery({
    queryKey: ['attendance-calendar', siteId, month],
    queryFn: () => api.get('/attendance/calendar', { query: { siteId, month } }),
    enabled: Boolean(month),
  });

export function useMarkAttendance(siteId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.put('/attendance', body),
    onSuccess: (result, body) => {
      // Show the saved marks immediately, then let the server copy replace them.
      const refused = new Set(result.errors.map((e) => e.workerId));
      const key = sheetKey(siteId, body.day);
      queryClient.setQueryData(key, (sheet) =>
        sheet
          ? {
              ...sheet,
              workers: sheet.workers.map((w) => {
                const change = body.records.find((r) => r.workerId === w.workerId);
                return change && !refused.has(w.workerId)
                  ? { ...w, status: change.status, method: 'manual' }
                  : w;
              }),
            }
          : sheet
      );
      for (const k of [
        key,
        ['attendance-calendar'],
        ['dashboard'],
        ['worker'],
        ['dues'],
        ['wages'],
      ])
        queryClient.invalidateQueries({ queryKey: k });
    },
  });
}
