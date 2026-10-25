import { Navigate, useLocation } from 'react-router-dom';
import { CloudOff } from 'lucide-react';
import { useT } from '../lib/i18n.jsx';
import { homeFor, useAuth } from './AuthProvider.jsx';
import { FullPageSkeleton } from '../components/ui/Skeleton.jsx';

function ServerUnreachable({ onRetry }) {
  const t = useT();
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center"
      role="alert"
    >
      <CloudOff className="h-10 w-10 text-ink-muted" aria-hidden="true" />
      <h1 className="text-2xl font-bold">{t('errors.unreachableTitle')}</h1>
      <p className="max-w-sm text-ink-muted">{t('errors.unreachableBody')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="h-12 rounded-control bg-brand px-6 font-semibold text-ink"
      >
        {t('common.retry')}
      </button>
    </main>
  );
}

export function RequireAuth({ children }) {
  const { status, loggedOut, retry } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSkeleton />;
  if (status === 'error') return <ServerUnreachable onRetry={retry} />;
  if (status === 'anonymous' && loggedOut) return <Navigate to="/login" replace />;
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
// Control characters are refused because URL parsing silently drops them ("/\t/evil" → "//evil").
export function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return null;
  if (next.includes('\\') || [...next].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127))
    return null;
  try {
    const url = new URL(next, window.location.origin);
    return url.origin === window.location.origin ? next : null;
  } catch {
    return null;
  }
}
