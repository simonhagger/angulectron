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

test('launch has no renderer console or page errors', async ({ page }) => {
  const runtimeErrors = attachRuntimeErrorCapture(page);

  await page.goto('/');
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForTimeout(500);

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
