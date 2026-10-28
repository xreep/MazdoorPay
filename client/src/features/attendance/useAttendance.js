import { useMutation, useQueryClient } from '@tanstack/react-query';
import { refreshAfterSave, useCurrentQuery } from '../../lib/query.js';
import { api } from '../../lib/api.js';

export const sheetKey = (siteId, day) => ['attendance-sheet', siteId, day];

export const useAttendanceSheet = (siteId, day) =>
  useCurrentQuery({
    queryKey: sheetKey(siteId, day),
    queryFn: () => api.get('/attendance/sheet', { query: { siteId, day } }),
    enabled: Boolean(siteId && day),
  });

export const useAttendanceCalendar = (siteId, month) =>
  useCurrentQuery({
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
      // The register already shows the saved marks; it refreshes quietly from the server.
      queryClient.invalidateQueries({ queryKey: key });
      refreshAfterSave(queryClient, [
        'attendance-calendar',
        'dashboard',
        'worker',
        'dues',
        'wages',
        'wage-slip',
      ]);
    },
  });
}

// Scanning a worker's ID card marks them present today on the server.
export function useScanCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code) => api.post('/attendance/scan', { code }),
    onSuccess: () => {
      // The register behind the scanner refreshes quietly, so unsaved marks there are kept.
      queryClient.invalidateQueries({ queryKey: ['attendance-sheet'] });
      refreshAfterSave(queryClient, [
        'attendance-calendar',
        'dashboard',
        'worker',
        'dues',
        'wages',
        'wage-slip',
      ]);
    },
  });
}
