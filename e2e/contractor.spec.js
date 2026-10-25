import { test, expect } from '@playwright/test';
import { uniqueEmail } from './helpers.js';

// The spec's contractor flow: Register → Create site → Add workers → Mark attendance → Track wages → Record payment.
test('a new contractor goes from sign-up to a printed receipt', async ({ page }) => {
  const email = uniqueEmail('journey');
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Your name').fill('Meena Construction');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Passw0rd123');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Empty dashboard points to the next step.
  await page.getByRole('link', { name: 'Add your first site' }).click();
  const siteDialog = page.getByRole('dialog', { name: 'Add site' });
  await siteDialog.getByLabel('Site name').fill('Lodha Palava – Dombivli');
  await siteDialog.getByLabel('Address or area (optional)').fill('Kalyan–Shil Road, Dombivli East');
  await siteDialog.getByRole('button', { name: 'Add site' }).click();
  await expect(page.getByText('Site added')).toBeVisible();

  for (const [name, role, rate] of [
    ['Shankar Jadhav', 'mason', '800'],
    ['Pooja Kamble', 'helper', '600'],
  ]) {
    await page.goto('/workers?new=1');
    const dialog = page.getByRole('dialog', { name: 'Add worker' });
    await dialog.getByLabel('Full name').fill(name);
    await dialog.getByLabel('Work').selectOption(role);
    await dialog.getByLabel('Daily wage').fill(rate);
    await dialog.getByLabel('Site').selectOption({ label: 'Lodha Palava – Dombivli' });
    await dialog.getByRole('button', { name: 'Add worker' }).click();
    await expect(page.getByText(`${name} added`)).toBeVisible();
  }

  await page.goto('/attendance');
  await page
    .getByRole('group', { name: 'Shankar Jadhav' })
    .getByRole('button', { name: 'Present' })
    .click();
  await page
    .getByRole('group', { name: 'Pooja Kamble' })
    .getByRole('button', { name: 'Half-day' })
    .click();
  await expect(page.getByText('2 unsaved changes')).toBeAttached();
  await page.getByRole('button', { name: 'Save attendance' }).click();
  await expect(page.getByText('Attendance saved for 2 workers')).toBeVisible();

  // ₹800 + half of ₹600 = ₹1,100 earned this week.
  await page.goto('/wages');
  await expect(page.getByRole('region', { name: 'Earned in this period' })).toContainText('₹1,100');

  await page.goto('/payments');
  await expect(page.getByText('₹1,100 pending for 2 workers')).toBeVisible();
  await page.getByRole('button', { name: 'Pay Shankar Jadhav' }).click();
  const pay = page.getByRole('dialog', { name: 'Record payment' });
  await expect(pay.getByLabel('Amount')).toHaveValue('800');
  await pay.getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByText('Payment saved')).toBeVisible();
  await expect(page.getByText('₹300 pending for 1 workers')).toBeVisible();

  await page.goto('/payments?tab=history');
  const row = page.getByRole('article', { name: /Shankar Jadhav/ });
  const receiptHref = await row.getByRole('link', { name: 'Receipt' }).getAttribute('href');
  await page.goto(receiptHref);
  await expect(page.getByRole('heading', { name: 'Payment receipt' })).toBeVisible();
  await expect(page.getByText('₹800')).toBeVisible();
  await expect(page.getByText('Meena Construction')).toBeVisible();
});

test('a demo contractor sees 45 days of history on the dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Use ravi.kumar@mazdoorpay.in' }).click();
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(
    page.getByRole('heading', { name: /Good (morning|afternoon|evening), Ravi/ })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Today’s attendance' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Last 30 days/ })).toBeVisible();
});
