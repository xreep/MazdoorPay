import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { DEMO, login } from './helpers.js';

// vite preview does not apply client/vercel.json, so serve each page with the production
// Content-Security-Policy and Permissions-Policy taken from it, and fail on anything they block.
const vercel = JSON.parse(fs.readFileSync(new URL('../client/vercel.json', import.meta.url)));
const header = (key) =>
  vercel.headers.flatMap((rule) => rule.headers).find((h) => h.key === key).value;
const CSP = header('Content-Security-Policy');
const PERMISSIONS = header('Permissions-Policy');

// Chromium's stand-in camera, so the card scanner can start without a real device.
test.use({
  permissions: ['camera'],
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
});

test('the app works under its production Content-Security-Policy', async ({ page }) => {
  const violations = [];
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': CSP,
        'permissions-policy': PERMISSIONS,
      },
    });
  });

  await login(page, DEMO.contractor);
  for (const path of ['/', '/attendance', '/workers', '/wages', '/payments', '/sites']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  await page.goto('/payments');
  await page
    .getByRole('button', { name: /record payment/i })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // The card scanner: camera stream plus the scanner's background worker.
  await page.goto('/attendance');
  await page.getByRole('button', { name: 'Scan ID cards' }).click();
  const scanner = page.getByRole('dialog', { name: 'Scan ID cards' });
  await expect
    .poll(() => scanner.locator('video').evaluate((v) => v.readyState >= 2 && !v.paused))
    .toBe(true);
  await expect(scanner.getByRole('alert')).toHaveCount(0);
  await scanner.getByRole('button', { name: 'Done' }).click();

  // Printed ID cards draw their QR codes.
  await page.getByRole('link', { name: 'Print ID cards' }).click();
  await expect(page.getByRole('img', { name: /^QR code for / }).first()).toBeVisible();

  expect(violations).toEqual([]);
});
