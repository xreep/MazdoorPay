import { test, expect } from '@playwright/test';
import { DEMO, login } from './helpers.js';

// Walkthrough 28 Oct: Payments showed "This screen ran into a problem" when it was the first page
// opened after signing in, and a reload fixed it. Cause: a deploy replaces every page's code file,
// so a tab loaded before the deploy asks for a file that is gone (404).
// The service worker fetches code files itself, out of reach of page.route, so these tests run
// without it to control exactly which file fails.
test.use({ serviceWorkers: 'block' });

const crashScreen = (page) => page.getByText('This screen ran into a problem');
const openPaymentsFromNav = (page) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Payments' }).click();

test('Payments loads when it is the first page opened after signing in', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  // Render's free plan answers far slower than a local API.
  await page.route('**/api/v1/**', async (route) => {
    await new Promise((r) => setTimeout(r, 900));
    await route.continue();
  });
  await login(page, DEMO.contractor);
  await openPaymentsFromNav(page);
  await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(crashScreen(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('after a deploy, an open tab still opens Payments instead of crashing', async ({ page }) => {
  // The deploy happened: the Payments code this tab knows about is gone, for the background
  // download after sign-in as well as for the click.
  let blocked = 0;
  await page.route(/\/assets\/PaymentsPage-[\w-]+\.js$/, async (route) => {
    if (blocked++ === 0) return route.fulfill({ status: 404, body: 'Not found' });
    return route.continue();
  });
  await login(page, DEMO.contractor);
  await openPaymentsFromNav(page);
  await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible({ timeout: 15_000 });
  await expect(crashScreen(page)).toHaveCount(0);
  expect(blocked).toBeGreaterThanOrEqual(2); // the failed file, then the fresh one after reloading
});

test('a page whose code really is missing shows the error screen, not endless reloads', async ({
  page,
}) => {
  await page.route(/\/assets\/PaymentsPage-[\w-]+\.js$/, (route) =>
    route.fulfill({ status: 404, body: 'Not found' })
  );
  await login(page, DEMO.contractor);
  let reloads = 0;
  page.on('load', () => (reloads += 1));
  await openPaymentsFromNav(page);
  await expect(crashScreen(page)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(3000);
  expect(reloads).toBeLessThanOrEqual(1); // one attempt at the new version, then the error
});
