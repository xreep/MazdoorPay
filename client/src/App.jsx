import { Suspense, lazy } from 'react';
import { Outlet } from 'react-router-dom';
import { RequireAuth, RequireRole } from './auth/guards.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { ServerWakeBanner } from './components/layout/ServerWakeBanner.jsx';
import { FullPageSkeleton } from './components/ui/Skeleton.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const SitesPage = lazy(() => import('./pages/SitesPage.jsx'));
const WorkersPage = lazy(() => import('./pages/WorkersPage.jsx'));
const WorkerProfilePage = lazy(() => import('./pages/WorkerProfilePage.jsx'));
const AttendancePage = lazy(() => import('./pages/AttendancePage.jsx'));
const MusterRollPrint = lazy(() => import('./pages/print/MusterRollPrint.jsx'));
const AttendanceReportPrint = lazy(() => import('./pages/print/AttendanceReportPrint.jsx'));

const Placeholder = ({ name }) => <h1 className="text-2xl font-bold">{name}</h1>;

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
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          contractorOnly([
            { path: '/', element: <DashboardPage /> },
            { path: '/attendance', element: <AttendancePage /> },
            { path: '/workers', element: <WorkersPage /> },
            { path: '/workers/:id', element: <WorkerProfilePage /> },
            { path: '/payments', element: <Placeholder name="Payments" /> },
            { path: '/wages', element: <Placeholder name="Wages" /> },
            { path: '/sites', element: <SitesPage /> },
          ]),
          {
            path: '/admin/*',
            element: (
              <RequireRole role="admin">
                <Placeholder name="Admin" />
              </RequireRole>
            ),
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
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
