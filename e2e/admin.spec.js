import { test, expect } from '@playwright/test';
import { DEMO, apiContractor, login } from './helpers.js';

// The spec's admin flow: Manage users → Monitor activity → Generate reports.
test('an admin suspends a contractor, sees it in the activity log, and reactivates them', async ({
  page,
  request,
}) => {
  const target = await apiContractor(request, { name: 'Rogue Builders' });
  await login(page, DEMO.admin);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Contractors' })).toBeVisible();

  await page.goto('/admin/users');
  await page.getByRole('searchbox', { name: 'Search name or email' }).fill(target.email);
  await page.getByRole('button', { name: 'View Rogue Builders' }).click();
  const drawer = page.getByRole('dialog', { name: 'Rogue Builders' });
  await drawer.getByRole('button', { name: 'Suspend contractor' }).click();
  const confirm = page.getByRole('dialog', { name: 'Suspend Rogue Builders?' });
  await confirm.getByLabel('Reason').fill('Fake worker entries reported by site engineer');
  await confirm.getByRole('button', { name: 'Suspend' }).click();
  await expect(page.getByText('Rogue Builders suspended')).toBeVisible();

  const blocked = await request.post('/api/v1/auth/login', {
    data: { email: target.email, password: target.password },
  });
  expect(blocked.status()).toBe(403);

  await page.keyboard.press('Escape');
  await page.goto('/admin/activity');
  await page.getByLabel('Action').selectOption('admin.suspend');
  const log = page.getByRole('list', { name: 'Activity log' });
  await expect(log.getByText('Suspended a contractor').first()).toBeVisible();
  await expect(log.getByText('Fake worker entries reported by site engineer')).toBeVisible();

  await page.goto('/admin/users');
  await page.getByRole('searchbox', { name: 'Search name or email' }).fill(target.email);
  await page.getByRole('button', { name: 'View Rogue Builders' }).click();
  await page
    .getByRole('dialog', { name: 'Rogue Builders' })
    .getByRole('button', { name: 'Reactivate contractor' })
    .click();
  await expect(page.getByText('Rogue Builders can log in again')).toBeVisible();
  const back = await request.post('/api/v1/auth/login', {
    data: { email: target.email, password: target.password },
  });
  expect(back.status()).toBe(200);
});

test('data checks and KPIs load for the admin', async ({ page }) => {
  await login(page, DEMO.admin);
  await page.goto('/admin/accuracy');
  await expect(page.getByText('No problems found')).toBeVisible();
  await page.goto('/admin/analytics');
  await expect(page.getByRole('region', { name: 'Payment tracking accuracy' })).toContainText('%');
});

test('a contractor cannot open the admin panel', async ({ page }) => {
  await login(page, DEMO.contractor);
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/$/);
});
