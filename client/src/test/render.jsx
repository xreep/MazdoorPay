import { render } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { createQueryClient } from '../lib/queryClient.js';
import { I18nProvider } from '../lib/i18n.jsx';
import { AuthContext, AuthProvider } from '../auth/AuthProvider.jsx';
import { routes } from '../App.jsx';

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location" hidden>
      {`${location.pathname}${location.search}`}
    </output>
  );
}

const withProbe = (children) => [
  {
    element: (
      <>
        <Outlet />
        <LocationProbe />
      </>
    ),
    children,
  },
];

const freshClient = () => {
  const client = createQueryClient();
  client.setDefaultOptions({
    queries: { retry: false, staleTime: Infinity },
    mutations: { retry: false },
  });
  return client;
};

// The whole app with the real auth provider (it boots via POST /auth/refresh — mock it).
export function renderApp(route) {
  const queryClient = freshClient();
  const router = createMemoryRouter(withProbe(routes), { initialEntries: [route] });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider lang="en">
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
  return { ...utils, router, queryClient };
}

export const contractor = {
  _id: 'c1',
  name: 'Ravi Kumar',
  email: 'ravi@example.com',
  role: 'contractor',
  preferredLanguage: 'en',
};
export const admin = {
  _id: 'a1',
  name: 'Asha Rao',
  email: 'admin@example.com',
  role: 'admin',
  preferredLanguage: 'en',
};

// One component (or a small route list) with a fake signed-in user.
export function renderWithProviders(
  ui,
  { route = '/', path = '/', user = contractor, extraRoutes = [] } = {}
) {
  const queryClient = freshClient();
  const auth = {
    status: 'authenticated',
    user,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  };
  const router = createMemoryRouter(
    withProbe([{ path, element: ui }, ...extraRoutes, { path: '*', element: null }]),
    {
      initialEntries: [route],
    }
  );
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider lang="en">
        <AuthContext.Provider value={auth}>
          <RouterProvider router={router} />
        </AuthContext.Provider>
      </I18nProvider>
    </QueryClientProvider>
  );
  return { ...utils, router, queryClient, auth };
}
