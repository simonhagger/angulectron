import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const attachRuntimeErrorCapture = (page: Page) => {
  const runtimeErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(`[console] ${message.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    runtimeErrors.push(`[pageerror] ${error.message}`);
  });

  return runtimeErrors;
};

test('home shell renders toolbar and action controls', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open file' })).toBeVisible();
});

test('labs toggle controls lab navigation visibility and persists on reload', async ({
  page,
}) => {
  await page.goto('/');

  const labsToggle = page.getByRole('button', { name: /Labs Mode:/ });
  await expect(labsToggle).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Material Showcase' }),
  ).toHaveCount(0);

  await labsToggle.click();
  await expect(
    page.getByRole('link', { name: 'Material Showcase' }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('link', { name: 'Material Showcase' }),
  ).toBeVisible();
});

test('settings routes navigate between app, api, and auth panels', async ({
  page,
}) => {
  await page.goto('/settings');

  await expect(
    page.getByRole('heading', { name: 'Settings', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'App Settings' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'API' }).click();
  await expect(page).toHaveURL(/\/settings\/api$/);
  await expect(
    page.getByRole('heading', { name: 'API Settings' }),
  ).toBeVisible();
  await expect(page.getByLabel('Secure endpoint URL template')).toBeVisible();

  await page.getByRole('link', { name: 'Auth' }).click();
  await expect(page).toHaveURL(/\/settings\/auth$/);
  await expect(
    page.getByRole('heading', { name: 'Auth Settings' }),
  ).toBeVisible();
  await expect(page.getByLabel('Issuer URL')).toBeVisible();
});

test('launch has no renderer console or page errors', async ({ page }) => {
  const runtimeErrors = attachRuntimeErrorCapture(page);

  await page.goto('/');
  await expect(page.getByRole('banner')).toBeVisible();
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/\/settings\/app$/);
  await page.getByRole('link', { name: 'API' }).click();
  await expect(page).toHaveURL(/\/settings\/api$/);
  await page.waitForTimeout(300);

  expect(runtimeErrors).toEqual([]);
});

test('@a11y shell page has no serious accessibility violations', async ({
  page,
}) => {
  await page.goto('/');

  const scanResults = await new AxeBuilder({ page }).analyze();
  const seriousViolations = scanResults.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? ''),
  );

  expect(seriousViolations).toEqual([]);
});
