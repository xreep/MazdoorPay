import { test, expect } from '@playwright/test';
import { DEMO, login } from './helpers.js';

// Captures README screenshots from the demo data. Run with: SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.js
test.skip(!process.env.SCREENSHOTS, 'only when SCREENSHOTS=1');

const shot = (page, name) => page.screenshot({ path: `docs/screenshots/${name}.png` });

test('desktop screens', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 860 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await shot(page, 'login');
  await login(page, DEMO.contractor);
  for (const [path, name] of [
    ['/', 'dashboard'],
    ['/attendance', 'attendance'],
    ['/wages?', 'wages'],
    ['/payments', 'payments'],
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0);
    await shot(page, name);
  }
  await page.goto('/workers');
  await page.getByRole('link', { name: /Manoj Sharma/ }).click();
  await page.waitForLoadState('networkidle');
  await shot(page, 'worker-profile');
  await page.getByRole('button', { name: 'Log out' }).first().click();
  await login(page, DEMO.admin);
  await page.waitForLoadState('networkidle');
  await shot(page, 'admin-overview');
});

test('phone screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, DEMO.contractor);
  await page.goto('/attendance');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Mark all present' }).click();
  await expect(page.getByRole('button', { name: 'Save attendance' })).toBeVisible();
  await page.waitForTimeout(600); // let the save bar finish sliding in
  await shot(page, 'phone-attendance');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await shot(page, 'phone-dashboard');
});
