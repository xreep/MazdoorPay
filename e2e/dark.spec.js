import { test, expect } from '@playwright/test';
import { DEMO, expectAccessible, login } from './helpers.js';

const isDark = (page) => page.evaluate(() => document.documentElement.classList.contains('dark'));

test.describe('with the phone set to dark', () => {
  test.use({ colorScheme: 'dark' });

  test('the app opens dark without a light flash, and every page passes the accessibility checks', async ({
    page,
  }) => {
    // Dark is applied by a script in <head>, before the app's code runs.
    await page.goto('/login', { waitUntil: 'commit' });
    await page.waitForSelector('html.dark', { state: 'attached' });
    await expectAccessible(page, 'login (dark)');

    await login(page, DEMO.contractor);
    for (const path of ['/', '/attendance', '/workers', '/wages', '/payments', '/sites']) {
      await page.goto(path);
      await expectAccessible(page, `${path} (dark)`);
    }
  });

  test('printed sheets stay black on white', async ({ page }) => {
    await login(page, DEMO.contractor);
    await page.goto('/wages');
    const href = await page.getByRole('link', { name: 'Print wage register' }).getAttribute('href');
    await page.goto(href);
    await expect(page.getByRole('heading', { name: 'Wage register' })).toBeVisible();
    expect(await isDark(page)).toBe(true);
    const sheet = await page.locator('.theme-light').evaluate((el) => {
      const s = getComputedStyle(el);
      return { background: s.backgroundColor, color: s.color };
    });
    expect(sheet).toEqual({ background: 'rgb(255, 255, 255)', color: 'rgb(0, 0, 0)' });
  });
});

test('the dark mode switch is remembered on this device', async ({ page }) => {
  await page.goto('/login');
  expect(await isDark(page)).toBe(false);
  await page.getByRole('button', { name: 'Dark mode' }).click();
  expect(await isDark(page)).toBe(true);
  await page.reload();
  await page.waitForSelector('html.dark', { state: 'attached' });
  await page.getByRole('button', { name: 'Dark mode' }).click();
  expect(await isDark(page)).toBe(false);
});
