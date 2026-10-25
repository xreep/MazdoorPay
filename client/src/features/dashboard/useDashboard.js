import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export const useDashboard = () =>
  useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/dashboard') });
