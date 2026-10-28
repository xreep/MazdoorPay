import { useCurrentQuery } from '../../lib/query.js';
import { api } from '../../lib/api.js';

export const useDashboard = () =>
  useCurrentQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/dashboard') });
