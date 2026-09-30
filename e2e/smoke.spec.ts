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
  await expect(page.getByRole('button', { name: 'Close trippin.xml' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navigator' })).toBeVisible();
  await page.getByRole('button', { name: 'Close trippin.xml' }).click();

  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/v2.xml');
  await expect(page.getByText('Could not open v2.xml')).toBeVisible();
  await expect(page.getByText(/not supported/)).toBeVisible();
});

test('lists the problems of a document with unresolved references', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/unresolved.xml');
  await expect(page.getByRole('button', { name: 'Close unresolved.xml' })).toBeVisible();
  await page.getByRole('button', { name: /Problems \(/ }).click();
  const panel = page.getByRole('region', { name: 'Diagnostics' });
  await expect(panel.getByText('unresolved-reference').first()).toBeVisible();
});

test('remembers a loaded file across a reload until it is forgotten', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Stored only in this browser.')).toBeVisible();
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/trippin.xml');
  await expect(page.getByRole('button', { name: 'Close trippin.xml' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Close trippin.xml' })).toBeHidden();
  await page.getByRole('button', { name: 'Open trippin.xml' }).click();
  await expect(page.getByRole('button', { name: 'Close trippin.xml' })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Forget trippin.xml' }).click();
  await expect(page.getByText('No recent files yet.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('No recent files yet.')).toBeVisible();
});

test('keeps the inspector collapsed across a reload', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/trippin.xml');
  await page.getByRole('button', { name: 'Collapse inspector' }).click();
  await expect(page.getByRole('button', { name: 'Expand inspector' })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Open trippin.xml' }).click();
  await expect(page.getByRole('button', { name: 'Expand inspector' })).toBeVisible();
});

test('navigator virtualizes 5,000 nodes, filters, and follows the arrow keys', async ({ page }) => {
  const types = Array.from(
    { length: 5000 },
    (_, i) =>
      `<EntityType Name="T${i}"><Key><PropertyRef Name="Id"/></Key><Property Name="Id" Type="Edm.Int32" Nullable="false"/></EntityType>`,
  ).join('');
  const xml = `<?xml version="1.0"?><edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"><edmx:DataServices><Schema Namespace="Big" xmlns="http://docs.oasis-open.org/odata/ns/edm">${types}</Schema></edmx:DataServices></edmx:Edmx>`;
  await page.goto('./');
  await page.getByLabel('Choose a metadata file').setInputFiles({
    name: 'big.xml',
    mimeType: 'application/xml',
    buffer: Buffer.from(xml),
  });

  const tree = page.getByRole('tree', { name: 'Model elements' });
  await expect(tree.getByRole('treeitem', { name: 'Big' })).toBeVisible();
  await tree.getByRole('treeitem', { name: 'Entity Types' }).click();
  await expect(tree.getByRole('treeitem', { name: 'T0', exact: true })).toBeVisible();
  expect(await tree.getByRole('treeitem').count()).toBeLessThan(100);

  await tree.getByRole('treeitem', { name: 'T0', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(tree.getByRole('treeitem', { name: 'T1', exact: true })).toBeFocused();

  await page.getByLabel('Filter the navigator').fill('T4999');
  await expect(tree.getByRole('treeitem', { name: 'T4999', exact: true })).toBeVisible();
  await expect(tree.getByRole('treeitem', { name: 'T0', exact: true })).toBeHidden();
  await page.getByLabel('Filter the navigator').fill('zzz');
  await expect(page.getByText('No matches.')).toBeVisible();
});

test('tabs: preview is replaced, double-click pins, middle-click closes, overflow lists the rest', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/trippin.xml');
  const tree = page.getByRole('tree', { name: 'Model elements' });
  await tree.getByRole('treeitem', { name: 'Entity Types' }).click();
  // Fluent renders a tab's text twice (the second copy reserves space for bold), so read the titles.
  const tabs = async () => {
    const all = await page.getByRole('tab').all();
    return Promise.all(all.map(async (t) => (await t.getAttribute('title'))?.split('.').pop()));
  };
  const item = (name: string) => tree.getByRole('treeitem', { name, exact: true });

  await item('Person').click();
  await expect.poll(tabs).toEqual(['Person']);
  await item('Trip').click();
  await expect.poll(tabs).toEqual(['Trip']);

  await item('Trip').dblclick();
  await item('Airline').click();
  await expect.poll(tabs).toEqual(['Trip', 'Airline']);
  await item('Airport').click();
  await expect.poll(tabs).toEqual(['Trip', 'Airport']);

  await page.getByRole('tab', { name: 'Airport' }).click({ button: 'middle' });
  await expect.poll(tabs).toEqual(['Trip']);

  await item('Airline').dblclick();
  await item('Flight').dblclick();
  await page.getByRole('tab', { name: 'Trip' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Close others' }).click();
  await expect.poll(tabs).toEqual(['Trip']);

  await page.setViewportSize({ width: 900, height: 700 });
  for (const name of ['Airline', 'Airport', 'Event', 'Flight', 'Person', 'PlanItem', 'Photo']) {
    await item(name).dblclick();
  }
  await page.setViewportSize({ width: 640, height: 700 });
  await expect(page.getByRole('button', { name: /\d+ more tabs/ })).toBeVisible();
});
