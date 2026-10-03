import { expect, test } from '@playwright/test';

const NS = 'Microsoft.OData.SampleService.Models.TripPin';

test('the diagram chunk and the layout worker load only when a diagram opens', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(new URL(request.url()).pathname));
  page.on('worker', (worker) => requested.push(new URL(worker.url()).pathname));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const loaded = (name: RegExp) => requested.some((path) => name.test(path));

  await page.goto('./');
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/trippin.xml');
  await expect(page.getByRole('navigation', { name: 'Navigator' })).toBeVisible();
  expect(loaded(/DiagramView/)).toBe(false);
  expect(loaded(/elk-worker/)).toBe(false);

  // A diagram link, as a pasted URL or the "Show relationships" button would open it.
  const docId = /#\/d\/([^/]+)/.exec(page.url())?.[1];
  await page.goto(`${page.url().replace(/#.*/, '')}#/d/${docId}/diagram/diagram:${NS}.Person`);
  const figure = page.getByRole('figure', { name: `Relationships of ${NS}.Person` });
  await expect(figure).toBeVisible();
  await expect(figure.getByTitle('Trip').first()).toBeVisible();
  await expect(figure.getByTitle('Photo').first()).toBeVisible();
  expect(loaded(/DiagramView/)).toBe(true);
  expect(loaded(/elk-worker/)).toBe(true);
  expect(errors).toEqual([]);
});
