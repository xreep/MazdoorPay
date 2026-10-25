import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { I18nProvider } from './lib/i18n.jsx';
import { createQueryClient } from './lib/queryClient.js';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { routes } from './App.jsx';
import '@fontsource-variable/inter';
import './index.css';

const queryClient = createQueryClient();
const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider lang="en">
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>
);
