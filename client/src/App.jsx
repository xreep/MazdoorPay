import { Suspense, lazy } from 'react';
import { Outlet } from 'react-router-dom';
import { RequireAuth, RequireRole } from './auth/guards.jsx';
import { ServerWakeBanner } from './components/layout/ServerWakeBanner.jsx';
import { FullPageSkeleton } from './components/ui/Skeleton.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import { RouteError } from './components/layout/ErrorBoundary.jsx';

const AppShell = lazy(() =>
  import('./components/layout/AppShell.jsx').then((m) => ({ default: m.AppShell }))
);
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const SitesPage = lazy(() => import('./pages/SitesPage.jsx'));
const WorkersPage = lazy(() => import('./pages/WorkersPage.jsx'));
const WorkerProfilePage = lazy(() => import('./pages/WorkerProfilePage.jsx'));
const AttendancePage = lazy(() => import('./pages/AttendancePage.jsx'));
const WagesPage = lazy(() => import('./pages/WagesPage.jsx'));
const WageRegisterPrint = lazy(() => import('./pages/print/WageRegisterPrint.jsx'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage.jsx'));
const ReceiptPrint = lazy(() => import('./pages/print/ReceiptPrint.jsx'));
const WageSlipPrint = lazy(() => import('./pages/print/WageSlipPrint.jsx'));
const PaymentsReportPrint = lazy(() => import('./pages/print/PaymentsReportPrint.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const MusterRollPrint = lazy(() => import('./pages/print/MusterRollPrint.jsx'));
const AttendanceReportPrint = lazy(() => import('./pages/print/AttendanceReportPrint.jsx'));

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
          { path: 'payments', element: <PaymentsReportPrint /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
