import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DEMO, login } from './helpers.js';

// Spec 10: axe checks of every page with zero serious or critical violations.
async function expectAccessible(page, label) {
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  const summary = serious.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(', ')}`
  );
  expect(summary, `${label} has accessibility violations`).toEqual([]);
}

test('login page', async ({ page }) => {
  await page.goto('/login');
  await expectAccessible(page, 'login');
});

test('contractor pages', async ({ page }) => {
  await login(page, DEMO.contractor);
  for (const path of [
    '/',
    '/sites',
    '/workers',
    '/attendance',
    '/attendance?tab=calendar',
    '/attendance?tab=reports',
    '/wages',
    '/payments',
    '/payments?tab=advances',
    '/payments?tab=history',
  ]) {
    await page.goto(path);
    await expectAccessible(page, path);
  }
  await page.goto('/workers');
  await page.getByRole('link', { name: /Amit Dubey/ }).click();
  await expectAccessible(page, 'worker profile');
});

test('admin pages', async ({ page }) => {
  await login(page, DEMO.admin);
  for (const path of [
    '/admin',
    '/admin/users',
    '/admin/activity',
    '/admin/accuracy',
    '/admin/analytics',
  ]) {
    await page.goto(path);
    await expectAccessible(page, path);
  }
});

test('contractor pages in Hindi', async ({ page }) => {
  await login(page, DEMO.contractor);
  await page.getByRole('button', { name: 'हिन्दी में देखें' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  try {
    for (const path of ['/', '/attendance', '/workers', '/wages', '/payments']) {
      await page.goto(path);
      await expectAccessible(page, `${path} (Hindi)`);
    }
  } finally {
    // The demo account is shared with the other tests.
    await page.getByRole('button', { name: 'English में देखें' }).click();
  }
});
