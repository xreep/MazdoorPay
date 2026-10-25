import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { DEMO, login } from './helpers.js';

// vite preview does not apply client/vercel.json, so serve each page with the production
// Content-Security-Policy taken from it and fail on anything the policy would block.
const vercel = JSON.parse(fs.readFileSync(new URL('../client/vercel.json', import.meta.url)));
const CSP = vercel.headers
  .flatMap((rule) => rule.headers)
  .find((h) => h.key === 'Content-Security-Policy').value;

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
      headers: { ...response.headers(), 'content-security-policy': CSP },
    });
  });

  await login(page, DEMO.contractor);
  for (const path of ['/', '/attendance', '/workers', '/wages', '/payments', '/sites']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  await page.goto('/payments');
  await page.getByRole('button', { name: /record payment/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(violations).toEqual([]);
});
