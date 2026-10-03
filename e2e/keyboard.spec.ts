import { expect, test, type Locator, type Page } from '@playwright/test';

const NS = 'Microsoft.OData.SampleService.Models.TripPin';

/** Presses Tab until `target` has the focus; fails if it takes more than `max` presses. */
async function tabTo(page: Page, target: Locator, max = 30) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab did not reach ${target.toString()} in ${max} presses`);
}

/** Whether the focus is somewhere inside `region`. */
const focusIn = (region: Locator) => region.evaluate((el) => el.contains(document.activeElement));

test('every flow works from the keyboard alone', async ({ page }) => {
  await page.goto('./');

  // The start page: its button is in the tab order. (The OS file chooser it opens cannot be driven.)
  await tabTo(page, page.getByRole('button', { name: 'Choose a file' }));
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/trippin.xml');
  const nav = page.getByRole('navigation', { name: 'Navigator' });
  await expect(nav).toBeVisible();

  // The navigator: arrows move, Enter opens, and the focus follows into the new tab's view.
  const tree = page.getByRole('tree', { name: 'Model elements' });
  await tabTo(page, tree.getByRole('treeitem').first());
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  const types = tree.getByRole('treeitem', { name: 'Entity Types' });
  await expect(types).toHaveAttribute('aria-expanded', 'true');
  await expect(types).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(tree.getByRole('treeitem', { name: 'Airline', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: 'Airline' })).toBeVisible();

  // Friendly/Technical: the toggle is reachable, and Space switches it.
  const mode = page.getByRole('group', { name: 'Detail for all views' });
  await tabTo(page, mode.getByRole('button', { name: 'Technical' }));
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('table', { name: 'Properties', exact: true }).getByRole('columnheader', {
      name: 'Nullable',
    }),
  ).toBeVisible();

  // Ctrl+K: the focus goes into the box; Enter opens the hit and the focus leaves the dialog for the view.
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('combobox', { name: 'Search the model' })).toBeFocused();
  await page.keyboard.type('person');
  await expect(page.getByRole('option').first()).toContainText('Person');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: 'Person' })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await focusIn(page.getByRole('main'))).toBe(true);

  // Escape closes the palette and returns the focus to the page, not to the void.
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog')).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.activeElement !== document.body)).toBe(true);

  // Tabs: the active tab is reachable, Enter keeps it open (Airline's preview was replaced), Delete closes.
  const person = page.getByRole('tab', { name: 'Person', exact: true });
  await tabTo(page, person);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('trip');
  await expect(page.getByRole('option').first()).toContainText('Entity type');
  await page.keyboard.press('Enter');
  const titles = async () =>
    Promise.all(
      (await page.getByRole('main').getByRole('tab').all()).map(async (t) =>
        (await t.getAttribute('title'))?.split('.').pop(),
      ),
    );
  await expect.poll(titles).toEqual(['Person', 'Trip']);
  await tabTo(page, page.getByRole('tab', { name: 'Trip', exact: true }));
  await page.keyboard.press('Delete');
  await expect.poll(titles).toEqual(['Person']);

  // The diagram: Ctrl+Enter in the palette opens it, a node takes the focus, and Enter opens its type.
  await page.keyboard.press('Control+k');
  await page.keyboard.type('person');
  await expect(page.getByRole('option').first()).toContainText('Entity type');
  await page.keyboard.press('Control+Enter');
  const figure = page.getByRole('figure', { name: `Relationships of ${NS}.Person` });
  await expect(figure.getByTitle('Trip', { exact: true })).toBeVisible();
  const node = figure.locator('.react-flow__node', {
    has: page.getByTitle('Trip', { exact: true }),
  });
  await tabTo(page, node);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: 'Trip', exact: true })).toBeVisible();

  // `?` lists the shortcuts, and Escape gives the focus back.
  await page.getByRole('main').getByRole('tab').first().focus();
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});
