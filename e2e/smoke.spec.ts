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

test('loads dropped metadata through the worker and rejects OData v2', async ({ page }) => {
  await page.goto('./');

  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/trippin.xml');
  await expect(page.getByText('Loaded trippin.xml')).toBeVisible();
  await expect(page.getByText(/\d+ entity types/)).toBeVisible();
  await expect(page.getByText(/\d+ entity sets/)).toBeVisible();

  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/v2.xml');
  await expect(page.getByText('Could not open v2.xml')).toBeVisible();
  await expect(page.getByText(/not supported/)).toBeVisible();
});

test('lists the problems of a document with unresolved references', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/unresolved.xml');
  await expect(page.getByText('Loaded unresolved.xml')).toBeVisible();
  const panel = page.getByRole('region', { name: 'Diagnostics' });
  await expect(panel.getByText('unresolved-reference').first()).toBeVisible();
});
