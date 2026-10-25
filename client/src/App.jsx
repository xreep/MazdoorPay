import { Outlet } from 'react-router-dom';
import { RequireAuth, RequireRole } from './auth/guards.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { ServerWakeBanner } from './components/layout/ServerWakeBanner.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

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
            { path: '/', element: <Placeholder name="Home" /> },
            { path: '/attendance', element: <Placeholder name="Attendance" /> },
            { path: '/workers', element: <Placeholder name="Workers" /> },
            { path: '/payments', element: <Placeholder name="Payments" /> },
            { path: '/wages', element: <Placeholder name="Wages" /> },
            { path: '/sites', element: <Placeholder name="Sites" /> },
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
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
