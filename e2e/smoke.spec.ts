import { expect, test } from '@playwright/test';

test.use({ colorScheme: 'dark' });

test('starts from a subpath, follows the OS theme, and keeps a manual choice', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'OData Explorer' })).toBeVisible();
  const html = page.locator('html');
  await expect(html).toHaveCSS('color-scheme', 'dark');

  await page.getByRole('button', { name: 'Theme' }).click();
  await page.getByRole('menuitemradio', { name: 'Light' }).click();
  await expect(html).toHaveCSS('color-scheme', 'light');

  await page.reload();
  await expect(html).toHaveCSS('color-scheme', 'light');
  expect(errors).toEqual([]);
});
