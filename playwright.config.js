import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run the real app: the API on an in-memory MongoDB seeded with demo data,
// and the production build of the client served by `vite preview` (which proxies /api).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /phone\.spec\.js/ },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /phone\.spec\.js/ },
  ],
  webServer: [
    {
      command: 'npm run dev:memory -w server',
      url: 'http://localhost:5055/api/v1/health',
      env: { PORT: '5055', AUTH_RATE_LIMIT_MAX: '1000', RATE_LIMIT_MAX: '100000' },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'npm run build -w client && npm run preview -w client -- --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
