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

test('shows the relationships of a type, widens them, and opens the tab of a clicked node', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/trippin.xml');
  const tree = page.getByRole('tree', { name: 'Model elements' });
  await tree.getByRole('treeitem', { name: 'Entity Types' }).click();
  await tree.getByRole('treeitem', { name: 'Person', exact: true }).click();
  await page.getByRole('button', { name: 'Show relationships' }).click();

  const figure = page.getByRole('figure', { name: `Relationships of ${NS}.Person` });
  await expect(figure.getByTitle('Trip', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Person diagram' })).toBeVisible();
  await expect(figure.getByTitle('PlanItem', { exact: true })).toBeHidden();

  await page.getByRole('combobox', { name: 'Hops' }).selectOption('2');
  await expect(figure.getByTitle('PlanItem', { exact: true })).toBeVisible();
  await page.getByRole('switch', { name: 'All properties' }).click({ force: true });
  await expect(figure.getByTitle('FirstName', { exact: true })).toBeVisible();

  await figure.getByTitle('Trip', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Trip', exact: true })).toBeVisible();
  // The diagram stays open next to it, still showing two hops.
  await page.getByRole('tab', { name: 'Person diagram' }).click();
  await expect(page.getByRole('combobox', { name: 'Hops' })).toHaveValue('2');
});

test('the palette shows relationships on Ctrl+Enter', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/trippin.xml');
  await page.getByRole('navigation', { name: 'Navigator' }).waitFor();
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Search the model' }).fill('airport');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByRole('tab', { name: 'Airport diagram' })).toBeVisible();
  await expect(page.getByRole('figure', { name: `Relationships of ${NS}.Airport` })).toBeVisible();
});
