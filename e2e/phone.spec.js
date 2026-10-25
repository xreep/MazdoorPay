import { test, expect } from '@playwright/test';
import { DEMO, login } from './helpers.js';

// Mobile-first: nothing scrolls sideways and the bottom tab bar is there on a phone.
test('core pages fit a phone screen', async ({ page }) => {
  await login(page, DEMO.contractor);
  for (const path of ['/', '/attendance', '/workers', '/wages', '/payments']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
    await expect(page.getByRole('navigation', { name: 'Quick' })).toBeVisible();
  }
});

test('core pages fit a phone screen in Hindi too', async ({ page }) => {
  await login(page, DEMO.contractor);
  await page.getByRole('button', { name: 'हिन्दी में देखें' }).click();
  await expect(page.getByRole('navigation', { name: 'जल्दी पहुँच' })).toBeVisible();
  try {
    for (const path of ['/', '/attendance', '/workers', '/wages', '/payments']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow, `${path} scrolls sideways in Hindi`).toBeLessThanOrEqual(0);
    }
  } finally {
    // The demo account is shared with the other tests.
    await page.getByRole('button', { name: 'English में देखें' }).click();
  }
});
