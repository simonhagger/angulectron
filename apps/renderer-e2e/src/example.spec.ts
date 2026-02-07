import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('home shell renders toolbar and action controls', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open file' })).toBeVisible();
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
