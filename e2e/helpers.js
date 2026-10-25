import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export { DEMO, OPS_ADMIN } from './accounts.js';

let counter = 0;
export const uniqueEmail = (prefix) => `${prefix}.${Date.now()}.${++counter}@e2e.mazdoorpay.test`;

export async function login(page, { email, password }) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

// Registers a contractor straight through the API and returns an access token for setup calls.
export async function apiContractor(request, overrides = {}) {
  const body = {
    name: 'E2E Contractor',
    email: uniqueEmail('contractor'),
    password: 'Passw0rd123',
    ...overrides,
  };
  const res = await request.post('/api/v1/auth/register', { data: body });
  expect(res.status()).toBe(201);
  const { accessToken, user } = await res.json();
  const authed = (method, path, data) =>
    request[method](`/api/v1${path}`, {
      data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  return { ...body, user, token: accessToken, call: authed };
}

// Spec 10: axe checks of every page with zero serious or critical violations.
export async function expectAccessible(page, label) {
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
