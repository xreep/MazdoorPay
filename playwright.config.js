import { defineConfig, devices } from '@playwright/test';
import { OPS_ADMIN } from './e2e/accounts.js';

// End-to-end tests run the real app: the API on an in-memory MongoDB seeded with demo data,
// and the production build of the client served by `vite preview` (which proxies /api).
// Both use their own ports and are always started fresh, so the tests can never write to a
// database behind an API you already have running on the usual ports.
const API_PORT = 5056;
const APP_PORT = 4174;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /phone\.spec\.js/ },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /phone\.spec\.js/ },
    {
      name: 'small-phone',
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 740 } },
      testMatch: /phone\.spec\.js/,
    },
  ],
  webServer: [
    {
      command: 'npm run dev:memory -w server',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      env: {
        PORT: String(API_PORT),
        AUTH_RATE_LIMIT_MAX: '1000',
        RATE_LIMIT_MAX: '100000',
        DEV_ADMIN_EMAIL: OPS_ADMIN.email,
        DEV_ADMIN_PASSWORD: OPS_ADMIN.password,
      },
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: `npm run build -w client && npm run preview -w client -- --port ${APP_PORT} --strictPort`,
      url: `http://localhost:${APP_PORT}`,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
