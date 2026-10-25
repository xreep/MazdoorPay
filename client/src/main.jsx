import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { I18nProvider } from './lib/i18n.jsx';
import { createQueryClient } from './lib/queryClient.js';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { routes } from './App.jsx';
import { followSystemTheme } from './lib/theme.js';
import '@fontsource-variable/inter';
// Hindi text; its unicode-range means it downloads only when Devanagari is on screen.
import '@fontsource-variable/noto-sans-devanagari';
import './index.css';

followSystemTheme(window.matchMedia('(prefers-color-scheme: dark)'));

const queryClient = createQueryClient();
const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>
);

// Installable app: the service worker caches the app shell (never data). Production builds only.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Without it the app still works; it just cannot be installed or open offline.
    });
  });
}
