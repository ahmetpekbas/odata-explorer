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

  // The URL names the open file, so a reload reopens it without the start page.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Close trippin.xml' })).toBeVisible();

  await page.getByRole('button', { name: 'Close trippin.xml' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Open trippin.xml' }).click();
  await expect(page.getByRole('button', { name: 'Close trippin.xml' })).toBeVisible();

  await page.getByRole('button', { name: 'Close trippin.xml' }).click();
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
    const all = await page.getByRole('main').getByRole('tab').all();
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

test('routing: the active tab is in the URL, back/forward work, and a pasted link reopens it', async ({
  page,
}) => {
  const person = 'Microsoft.OData.SampleService.Models.TripPin.Person';
  await page.goto('./');
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/trippin.xml');
  const tree = page.getByRole('tree', { name: 'Model elements' });
  await tree.getByRole('treeitem', { name: 'Entity Types' }).click();
  const heading = (name: string) => page.getByRole('heading', { name, exact: true });

  await tree.getByRole('treeitem', { name: 'Person', exact: true }).click();
  await expect(heading('Person')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/d/[^/]+/entityType/${person}$`));
  await tree.getByRole('treeitem', { name: 'Trip', exact: true }).click();
  await expect(heading('Trip')).toBeVisible();

  await page.goBack();
  await expect(heading('Person')).toBeVisible();
  await page.goForward();
  await expect(heading('Trip')).toBeVisible();

  // A pasted link: a fresh load of the same URL finds the file in the recent list.
  await page.goBack();
  const url = page.url();
  await page.goto('about:blank');
  await page.goto(url);
  await expect(heading('Person')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Person' })).toBeVisible();
});

test('routing: a problem with a target opens its element', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/unresolved.xml');
  await page.getByRole('button', { name: /Problems \(/ }).click();
  const rows = page.getByRole('region', { name: 'Diagnostics' }).getByRole('button');
  const problems = page.getByRole('tab', { name: 'Problems' });
  // A problem about an element opens that element, which takes the place of the schema preview.
  for (const row of await rows.all()) {
    await row.click();
    if ((await problems.getAttribute('aria-selected')) === 'false') break;
  }
  await expect(problems).toHaveAttribute('aria-selected', 'false');
});

test('detail views: a new file opens on its schema, and an entity shows both modes', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/trippin.xml');
  await expect(page.getByRole('heading', { name: 'What it defines' })).toBeVisible();

  const tree = page.getByRole('tree', { name: 'Model elements' });
  await tree.getByRole('treeitem', { name: 'Entity Types' }).click();
  await tree.getByRole('treeitem', { name: 'Person', exact: true }).click();
  const properties = page.getByRole('table', { name: 'Properties', exact: true });
  await expect(properties.getByRole('columnheader', { name: 'Required' })).toBeVisible();
  await expect(properties.getByRole('cell', { name: 'List of Text' })).toBeVisible();

  // A link in a view opens its target.
  await page.getByRole('button', { name: 'Link to Trip (many)' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Trip' })).toBeVisible();

  await page
    .getByRole('group', { name: 'Detail for this view' })
    .getByRole('button', { name: 'Technical' })
    .click();
  await expect(properties.getByRole('columnheader', { name: 'Nullable' })).toBeVisible();
  await expect(properties.getByRole('cell', { name: 'Edm.Guid' })).toBeVisible();
});

test('restores the open tabs and the active one when a file is reopened', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/trippin.xml');
  const tree = page.getByRole('tree', { name: 'Model elements' });
  await tree.getByRole('treeitem', { name: 'Entity Types' }).click();
  for (const name of ['Person', 'Trip', 'Airline']) {
    await tree.getByRole('treeitem', { name, exact: true }).dblclick();
  }
  await tree.getByRole('treeitem', { name: 'Flight', exact: true }).click();
  await page.getByRole('tab', { name: 'Trip', exact: true }).click();
  const titles = async () => {
    const all = await page.getByRole('main').getByRole('tab').all();
    return Promise.all(all.map(async (t) => (await t.getAttribute('title'))?.split('.').pop()));
  };
  await expect.poll(titles).toEqual(['Person', 'Trip', 'Airline', 'Flight']);

  // The hash names the file and the active tab; the rest comes back with the file.
  await page.reload();
  await expect.poll(titles).toEqual(['Person', 'Trip', 'Airline', 'Flight']);
  await expect(page.getByRole('tab', { name: 'Trip', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  // From the start page, the recent file brings them back too.
  await page.getByRole('button', { name: 'Close trippin.xml' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Open trippin.xml' }).click();
  await expect.poll(titles).toEqual(['Person', 'Trip', 'Airline', 'Flight']);
  await expect(page.getByRole('tab', { name: 'Trip', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('the source panel loads its chunk only when the Source tab opens, and follows the selection', async ({
  page,
}) => {
  const chunks: string[] = [];
  page.on('request', (request) => {
    if (/SourcePanel/.test(request.url())) chunks.push(request.url());
  });
  await page.goto('./');
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/trippin.xml');
  const tree = page.getByRole('tree', { name: 'Model elements' });
  await tree.getByRole('treeitem', { name: 'Entity Types' }).click();
  await tree.getByRole('treeitem', { name: 'Airline', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Airline' })).toBeVisible();
  expect(chunks).toEqual([]);

  await page.getByRole('tab', { name: 'Source' }).click();
  const source = page.getByRole('textbox', { name: 'Source' });
  await expect(source).toContainText('<EntityType Name="Airline"');
  expect(chunks).toHaveLength(1);

  // Selecting a row shows that property's own element.
  await page.getByRole('row', { name: /AirlineCode/ }).click();
  await expect(source).toContainText('<Property Name="AirlineCode"');
  await expect(source).not.toContainText('<EntityType');
});

test('a qualified name in the source opens that element', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/trippin.xml');
  const tree = page.getByRole('tree', { name: 'Model elements' });
  await tree.getByRole('treeitem', { name: 'Entity Types' }).click();
  await tree.getByRole('treeitem', { name: 'Person', exact: true }).click();
  await page.getByRole('tab', { name: 'Source' }).click();

  const trips = page.locator('.cm-oe-link[data-link-id$=".Trip"]').first();
  await expect(trips).toBeVisible();
  await trips.click();
  await expect(page.getByRole('heading', { level: 2, name: 'Trip' })).toBeVisible();
});
