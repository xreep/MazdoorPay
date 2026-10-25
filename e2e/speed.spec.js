import { test, expect } from '@playwright/test';
import { apiContractor, login } from './helpers.js';

// Spec 10 usability proof: marking 15 workers takes under 30 seconds of scripted interaction.
test('marks 15 workers present and saves in under 30 seconds', async ({ page, request }) => {
  const c = await apiContractor(request, { name: 'Speed Test Contractor' });
  const site = await (await c.call('post', '/sites', { name: 'Speed Site' })).json();
  const names = Array.from({ length: 15 }, (_, i) => `Worker ${String(i + 1).padStart(2, '0')}`);
  for (const name of names) {
    const res = await c.call('post', '/workers', {
      name,
      role: 'labourer',
      dailyRate: 60000,
      siteId: site.site._id,
    });
    expect(res.status()).toBe(201);
  }
  await login(page, { email: c.email, password: c.password });
  await page.goto('/attendance');
  await expect(page.getByRole('group', { name: names[14] })).toBeVisible();

  const started = Date.now();
  for (const name of names) {
    await page.getByRole('group', { name }).getByRole('button', { name: 'Present' }).click();
  }
  await page.getByRole('button', { name: 'Save attendance' }).click();
  await expect(page.getByText('Attendance saved for 15 workers')).toBeVisible();
  const seconds = (Date.now() - started) / 1000;
  test.info().annotations.push({
    type: 'timing',
    description: `15 workers marked and saved in ${seconds.toFixed(1)} s`,
  });
  console.log(`15 workers marked and saved in ${seconds.toFixed(1)} s`);
  expect(seconds).toBeLessThan(30);
});
