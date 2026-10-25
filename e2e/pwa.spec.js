import { test, expect } from '@playwright/test';

// Installable app: a valid manifest with icons, and a service worker that caches the app shell.
test('the app can be installed and opens without a connection', async ({ page, context }) => {
  await page.goto('/login');
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await page.request.get(manifestHref)).json();
  expect(manifest).toMatchObject({ name: 'MazdoorPay', display: 'standalone', start_url: '/' });
  expect(manifest.icons.map((i) => i.purpose)).toEqual(['any', 'any', 'maskable']);
  for (const icon of manifest.icons) {
    const res = await page.request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
  }

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  // Offline: the cached shell opens and says it cannot reach the server; nothing is shown stale.
  await context.setOffline(true);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Could not reach MazdoorPay' })).toBeVisible();
  await context.setOffline(false);
});
