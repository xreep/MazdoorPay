import { expect } from '@playwright/test';

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
