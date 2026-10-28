import { test, expect } from '@playwright/test';
import { apiContractor } from './helpers.js';

// 28 Oct test report, reproduced with a TEST account against a slow API (like Render's free plan).
// After a save or navigation a page must show the new state or a loading state, never old figures
// presented as current. Each check records every frame the page draws until the new state shows.

const IST = (offsetDays = 0) =>
  new Date(Date.now() + 5.5 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);

async function testAccount(request) {
  const c = await apiContractor(request, { name: 'TEST Contractor' });
  const site = (await (await c.call('post', '/sites', { name: 'TEST Site' })).json()).site;
  const worker = async (name, extra = {}) =>
    (
      await (
        await c.call('post', '/workers', {
          name,
          role: 'mason',
          dailyRate: 60000,
          siteId: site._id,
          joinedOn: IST(-7),
          ...extra,
        })
      ).json()
    ).worker;
  return { ...c, site, worker };
}

async function signIn(page, c) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(c.email);
  await page.getByLabel('Password', { exact: true }).fill(c.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

// Frames of the main area's text, from now until `done` matches (or the timeout).
const framesUntil = (page, done, { skipWhileDialog = false, timeout = 8000 } = {}) =>
  page.evaluate(
    async ({ done, skipWhileDialog, timeout }) => {
      const frames = [];
      const until = new RegExp(done);
      const start = performance.now();
      while (performance.now() - start < timeout) {
        const main = document.querySelector('main')?.innerText ?? '';
        if (!(skipWhileDialog && document.querySelector('[role="dialog"]'))) frames.push(main);
        if (until.test(main) && !(skipWhileDialog && document.querySelector('[role="dialog"]')))
          break;
        await new Promise((r) => requestAnimationFrame(r));
      }
      return frames;
    },
    { done: done.source, skipWhileDialog, timeout }
  );

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().method() === 'GET') await new Promise((r) => setTimeout(r, 700));
    await route.continue();
  });
});

test('#2a after recording a payment, Wages never shows the pre-payment figures', async ({
  page,
  request,
}) => {
  const c = await testAccount(request);
  const w = await c.worker('TEST Worker');
  await c.call('put', '/attendance', {
    day: IST(),
    records: [{ workerId: w._id, status: 'present' }],
  });
  await signIn(page, c);

  // Wages is visited first, so the pre-payment figures are in the app's memory.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Wages' }).click();
  await expect(page.getByText(/Paid in this period\s*₹0/)).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Workers' })
    .click();
  await page
    .getByRole('link', { name: /TEST Worker/ })
    .first()
    .click();
  await page.getByRole('link', { name: 'Record payment' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record payment' });
  await expect(dialog.getByLabel('Amount')).toHaveValue('600');
  await dialog.getByLabel('Amount').fill('300');
  await dialog.getByRole('button', { name: 'Save payment' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Wages' }).click();
  const frames = await framesUntil(page, /Paid in this period\s*₹300/);
  expect(frames.at(-1)).toMatch(/Paid in this period\s*₹300/);
  expect(frames.filter((f) => /Paid in this period\s*₹0/.test(f))).toEqual([]);
});

test('#2b the worker count never shows the old number after adding a worker', async ({
  page,
  request,
}) => {
  const c = await testAccount(request);
  await c.worker('TEST Worker');
  await signIn(page, c);
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Workers' })
    .click();
  await expect(page.getByText(/^1 workers?$/)).toBeVisible();

  await page.getByRole('button', { name: 'Add worker' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add worker' });
  await dialog.getByLabel('Full name').fill('TEST Second');
  await dialog.getByLabel('Daily wage').fill('500');
  await dialog.getByLabel('Site').selectOption({ label: 'TEST Site' });
  await dialog
    .getByRole('button', { name: /Add worker|Save/ })
    .last()
    .click();
  const frames = await framesUntil(page, /\b2 workers\b/, { skipWhileDialog: true });
  expect(frames.at(-1)).toMatch(/\b2 workers\b/);
  expect(frames.filter((f) => /\b1 workers?\b/.test(f))).toEqual([]);
});

test('#2c a search never shows the previous results as its own', async ({ page, request }) => {
  const c = await testAccount(request);
  await c.worker('TEST Worker');
  await c.worker('TEST Second');
  await signIn(page, c);
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Workers' })
    .click();
  await expect(page.getByText('2 workers', { exact: true })).toBeVisible();

  await page.getByRole('searchbox').fill('Second');
  const frames = await framesUntil(page, /\b1 worker\b/);
  expect(frames.at(-1)).toMatch(/TEST Second/);
  // While "Second" is typed, the list must not show the other worker as a result.
  expect(frames.filter((f) => /TEST Worker/.test(f))).toEqual([]);
});

test('#2d History right after an advance never shows the list without it', async ({
  page,
  request,
}) => {
  const c = await testAccount(request);
  const w = await c.worker('TEST Worker');
  await c.call('put', '/attendance', {
    day: IST(),
    records: [{ workerId: w._id, status: 'present' }],
  });
  await c.call('post', '/payments', {
    workerId: w._id,
    amount: 30000,
    type: 'wage',
    method: 'cash',
    idempotencyKey: crypto.randomUUID(),
  });
  await signIn(page, c);
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Payments' })
    .click();
  await page.getByRole('tab', { name: /History/ }).click();
  await expect(page.getByRole('article', { name: 'TEST Worker' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Record payment' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Record payment' });
  await dialog.getByLabel('Worker').selectOption({ label: 'TEST Worker' });
  await dialog.getByRole('radio', { name: 'Advance' }).click();
  await dialog.getByLabel('Amount').fill('100');
  await dialog.getByRole('button', { name: 'Save payment' }).click();
  const frames = await framesUntil(page, /₹100[\s\S]*₹300|₹300[\s\S]*₹100/, {
    skipWhileDialog: true,
  });
  expect(frames.at(-1)).toMatch(/₹100/);
  // A frame listing the ₹300 wage without the new ₹100 advance is the old history.
  expect(frames.filter((f) => /₹300/.test(f) && !/₹100/.test(f))).toEqual([]);
});

test('#1 a one-day period explains the all-time balance', async ({ page, request }) => {
  const c = await testAccount(request);
  const w = await c.worker('TEST Worker');
  // The tester's case: ₹600 earned on the chosen day; ₹600 earned and ₹500 paid the day after.
  await c.call('put', '/attendance', {
    day: IST(-1),
    records: [{ workerId: w._id, status: 'present' }],
  });
  await c.call('put', '/attendance', {
    day: IST(),
    records: [{ workerId: w._id, status: 'present' }],
  });
  await c.call('post', '/payments', {
    workerId: w._id,
    amount: 50000,
    type: 'wage',
    method: 'cash',
    idempotencyKey: crypto.randomUUID(),
  });
  await signIn(page, c);
  await page.goto(`/wages?from=${IST(-1)}&to=${IST(-1)}`);
  await expect(page.getByRole('columnheader', { name: 'Balance due (all time)' })).toBeVisible();
  await expect(page.getByText('Balance due (all time)').first()).toBeVisible();
  await page.getByRole('button', { name: 'Show breakdown for TEST Worker' }).click();
  const madeUp = page.getByRole('list', { name: 'How the balance due is made up' });
  await expect(madeUp).toContainText('Earned in this period+ ₹600');
  await expect(madeUp).toContainText('Paid in this period− ₹0');
  await expect(madeUp).toContainText('From after this period+ ₹100');
  await expect(madeUp).toContainText('Balance due (all time)₹700');
});
