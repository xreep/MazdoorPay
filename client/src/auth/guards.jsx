import { Navigate, useLocation } from 'react-router-dom';
import { homeFor, useAuth } from './AuthProvider.jsx';
import { FullPageSkeleton } from '../components/ui/Skeleton.jsx';

export function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSkeleton />;
  if (status === 'anonymous') {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

export function RequireRole({ role, children }) {
  const { user } = useAuth();
  if (user?.role !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
}

// Only same-app paths are allowed as a post-login destination (no open redirects).
export const safeNext = (next) =>
  typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')
    ? next
    : null;
