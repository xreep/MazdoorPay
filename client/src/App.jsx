import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { RequireAuth, RequireRole } from './auth/guards.jsx';
import { ServerWakeBanner } from './components/layout/ServerWakeBanner.jsx';
import { FullPageSkeleton } from './components/ui/Skeleton.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import { RouteError } from './components/layout/ErrorBoundary.jsx';
import { lazyWithReload } from './lib/lazyWithReload.js';

const AppShell = lazyWithReload(() =>
  import('./components/layout/AppShell.jsx').then((m) => ({ default: m.AppShell }))
);
const DashboardPage = lazyWithReload(() => import('./pages/DashboardPage.jsx'));
const SitesPage = lazyWithReload(() => import('./pages/SitesPage.jsx'));
const WorkersPage = lazyWithReload(() => import('./pages/WorkersPage.jsx'));
const WorkerProfilePage = lazyWithReload(() => import('./pages/WorkerProfilePage.jsx'));
const AttendancePage = lazyWithReload(() => import('./pages/AttendancePage.jsx'));
const WagesPage = lazyWithReload(() => import('./pages/WagesPage.jsx'));
const WageRegisterPrint = lazyWithReload(() => import('./pages/print/WageRegisterPrint.jsx'));
const PaymentsPage = lazyWithReload(() => import('./pages/PaymentsPage.jsx'));
const ReceiptPrint = lazyWithReload(() => import('./pages/print/ReceiptPrint.jsx'));
const WageSlipPrint = lazyWithReload(() => import('./pages/print/WageSlipPrint.jsx'));
const IdCardsPrint = lazyWithReload(() => import('./pages/print/IdCardsPrint.jsx'));
const PaymentsReportPrint = lazyWithReload(() => import('./pages/print/PaymentsReportPrint.jsx'));
const AdminPage = lazyWithReload(() => import('./pages/AdminPage.jsx'));
const MusterRollPrint = lazyWithReload(() => import('./pages/print/MusterRollPrint.jsx'));
const AttendanceReportPrint = lazyWithReload(
  () => import('./pages/print/AttendanceReportPrint.jsx')
);
const StatementPage = lazyWithReload(() => import('./pages/StatementPage.jsx'));

function RootLayout() {
  return (
    <>
      <ServerWakeBanner />
      <Outlet />
    </>
  );
}

const contractorOnly = (children) => ({
  element: (
    <RequireRole role="contractor">
      <Outlet />
    </RequireRole>
  ),
  children,
});

export const routes = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        // Public: a worker's own statement, opened from the private link they were sent.
        path: '/s/:token',
        element: (
          <Suspense fallback={<FullPageSkeleton />}>
            <StatementPage />
          </Suspense>
        ),
      },
      {
        element: (
          <RequireAuth>
            <Suspense fallback={<FullPageSkeleton />}>
              <AppShell />
            </Suspense>
          </RequireAuth>
        ),
        children: [
          contractorOnly([
            { path: '/', element: <DashboardPage /> },
            { path: '/attendance', element: <AttendancePage /> },
            { path: '/workers', element: <WorkersPage /> },
            { path: '/workers/:id', element: <WorkerProfilePage /> },
            { path: '/payments', element: <PaymentsPage /> },
            { path: '/wages', element: <WagesPage /> },
            { path: '/sites', element: <SitesPage /> },
          ]),
          {
            element: (
              <RequireRole role="admin">
                <Outlet />
              </RequireRole>
            ),
            children: [
              { path: '/admin', element: <AdminPage section="overview" /> },
              { path: '/admin/users', element: <AdminPage section="users" /> },
              { path: '/admin/activity', element: <AdminPage section="activity" /> },
              { path: '/admin/accuracy', element: <AdminPage section="accuracy" /> },
              { path: '/admin/analytics', element: <AdminPage section="analytics" /> },
            ],
          },
        ],
      },
      {
        path: '/print',
        element: (
          <RequireAuth>
            <RequireRole role="contractor">
              <Suspense fallback={<FullPageSkeleton />}>
                <Outlet />
              </Suspense>
            </RequireRole>
          </RequireAuth>
        ),
        children: [
          { path: 'muster-roll', element: <MusterRollPrint /> },
          { path: 'attendance', element: <AttendanceReportPrint /> },
          { path: 'wage-register', element: <WageRegisterPrint /> },
          { path: 'receipt/:id', element: <ReceiptPrint /> },
          { path: 'wage-slip/:id', element: <WageSlipPrint /> },
          { path: 'cards', element: <IdCardsPrint /> },
          { path: 'payments', element: <PaymentsReportPrint /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
