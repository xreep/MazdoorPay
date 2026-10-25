import { test, expect } from '@playwright/test';
import { DEMO, expectAccessible, login } from './helpers.js';

// A contractor sends a worker their private statement link; the worker opens it without an account.
test('a worker opens their statement from the link, without logging in', async ({
  page,
  browser,
}) => {
  await login(page, DEMO.contractor);
  await page.goto('/workers');
  await page.getByRole('link', { name: /Amit Dubey/ }).click();
  const due = await page.getByRole('region', { name: 'Money' }).locator('p.num').last().innerText();

  const section = page.getByRole('region', { name: 'Statement link' });
  await section.getByRole('button', { name: /Make (statement|a new) link/ }).click();
  const url = await section
    .getByRole('textbox', { name: /Statement link for Amit Dubey/ })
    .inputValue();
  expect(url).toMatch(/\/s\/[A-Za-z0-9_-]{43}$/);

  const stranger = await browser.newContext();
  const worker = await stranger.newPage();
  await worker.goto(new URL(url).pathname);
  await expect(worker.getByRole('heading', { name: 'Amit Dubey' })).toBeVisible();
  await expect(worker.getByRole('region', { name: /You are owed|आपको मिलना है/ })).toContainText(
    due
  );
  await expect(worker.getByRole('link', { name: /log in/i })).toHaveCount(0);
  await expectAccessible(worker, 'statement page');

  // Stopping the link shuts the page for the worker.
  await section.getByRole('button', { name: 'Stop link' }).click();
  await worker.reload();
  await expect(
    worker.getByRole('heading', { name: /This link does not work|यह लिंक काम नहीं कर रहा/ })
  ).toBeVisible();
  await stranger.close();
});
