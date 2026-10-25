import { Outlet } from 'react-router-dom';
import { RequireAuth, RequireRole } from './auth/guards.jsx';
import { ServerWakeBanner } from './components/layout/ServerWakeBanner.jsx';
import LoginPage from './pages/LoginPage.jsx';

function RootLayout() {
  return (
    <>
      <ServerWakeBanner />
      <Outlet />
    </>
  );
}

const Placeholder = ({ name }) => <main className="p-6 text-2xl font-semibold">{name}</main>;

export const routes = [
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: (
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          {
            element: (
              <RequireRole role="contractor">
                <Outlet />
              </RequireRole>
            ),
            children: [
              { path: '/', element: <Placeholder name="Dashboard" /> },
              { path: '/workers', element: <Placeholder name="Workers" /> },
              { path: '/payments', element: <Placeholder name="Payments" /> },
            ],
          },
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
      { path: '*', element: <Placeholder name="Not found" /> },
    ],
  },
];
