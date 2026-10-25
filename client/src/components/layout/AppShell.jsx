import { Suspense, useEffect, useState } from 'react';
import { NavLink, useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Building2,
  Calculator,
  ClipboardCheck,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useT } from '../../lib/i18n.jsx';
import { initials } from '../../lib/format.js';
import { Modal } from '../ui/Modal.jsx';
import { SkeletonRows } from '../ui/Skeleton.jsx';
import { Logo } from './Logo.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';

export const CONTRACTOR_NAV = [
  { to: '/', label: 'nav.home', icon: Home, end: true },
  { to: '/attendance', label: 'nav.attendance', icon: ClipboardCheck },
  { to: '/workers', label: 'nav.workers', icon: Users },
  { to: '/payments', label: 'nav.payments', icon: Wallet },
  { to: '/wages', label: 'nav.wages', icon: Calculator },
  { to: '/sites', label: 'nav.sites', icon: Building2 },
];

export const ADMIN_NAV = [
  { to: '/admin', label: 'nav.overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'nav.users', icon: Users },
  { to: '/admin/activity', label: 'nav.activity', icon: History },
  { to: '/admin/accuracy', label: 'nav.accuracy', icon: ShieldCheck },
  { to: '/admin/analytics', label: 'nav.analytics', icon: BarChart3 },
];

const QUICK_COUNT = 4;

function SideLink({ item }) {
  const t = useT();
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex h-12 items-center gap-3 rounded-control px-3 font-medium transition ${
          isActive ? 'bg-ink text-white' : 'text-ink-muted hover:bg-ink/5 hover:text-ink'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`h-5 w-5 ${isActive ? 'text-brand' : ''}`} aria-hidden="true" />
          {t(item.label)}
        </>
      )}
    </NavLink>
  );
}

function TabLink({ item }) {
  const t = useT();
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex h-16 flex-col items-center justify-center gap-1 text-[0.72rem] font-semibold ${isActive ? 'text-ink' : 'text-ink-muted'}`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex h-8 w-12 items-center justify-center rounded-full transition ${isActive ? 'bg-brand text-ink' : ''}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          {t(item.label)}
        </>
      )}
    </NavLink>
  );
}

function AnimatedOutlet() {
  const outlet = useOutlet();
  const { pathname } = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}

export function AppShell() {
  const t = useT();
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const nav = user?.role === 'admin' ? ADMIN_NAV : CONTRACTOR_NAV;

  useEffect(() => setMoreOpen(false), [pathname]);

  // RequireAuth moves a logged-out user to /login.
  const onLogout = () => {
    setMoreOpen(false);
    logout();
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <div className="hivis-tape fixed inset-x-0 top-0 z-40 h-1.5" aria-hidden="true" />

      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface px-4 pb-6 pt-8 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav aria-label={t('nav.main')} className="mt-8 space-y-1">
          {nav.map((item) => (
            <SideLink key={item.to} item={item} />
          ))}
        </nav>
        <div className="mt-auto border-t border-border pt-4">
          <div className="flex items-center gap-3 px-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
              {initials(user?.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{user?.name}</p>
              <p className="truncate text-sm text-ink-muted">
                {user?.role === 'admin' ? t('nav.roleAdmin') : t('nav.roleContractor')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="mt-3 flex h-11 w-full items-center gap-3 rounded-control px-3 text-ink-muted hover:bg-ink/5 hover:text-ink"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-1.5 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur lg:hidden">
          <Logo />
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-xs font-bold text-white"
            aria-label={user?.name}
          >
            {initials(user?.name)}
          </span>
        </header>
        <main
          id="main"
          className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-14 lg:pt-10"
        >
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<SkeletonRows n={6} className="h-20" />}>
              <AnimatedOutlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <nav
        aria-label={t('nav.quick')}
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {nav.slice(0, QUICK_COUNT).map((item) => (
          <TabLink key={item.to} item={item} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex h-16 flex-col items-center justify-center gap-1 text-[0.72rem] font-semibold text-ink-muted"
        >
          <span className="flex h-8 w-12 items-center justify-center rounded-full">
            <Menu className="h-5 w-5" aria-hidden="true" />
          </span>
          {t('nav.more')}
        </button>
      </nav>

      <Modal
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={t('nav.more')}
        variant="drawer"
      >
        <nav className="space-y-1">
          {nav.slice(QUICK_COUNT).map((item) => (
            <SideLink key={item.to} item={item} />
          ))}
        </nav>
        <button
          type="button"
          onClick={onLogout}
          className="mt-4 flex h-12 w-full items-center gap-3 rounded-control border border-border px-3 font-medium"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          {t('nav.logout')}
        </button>
      </Modal>
    </div>
  );
}
