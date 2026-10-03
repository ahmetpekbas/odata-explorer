// Takes the README screenshots of the production build, into docs/screenshots/. Run with
// `npm run screenshots` (after `npm run build`); the pictures are committed, so rerun it only when the
// look of the app changes.
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const OUT = new URL('../docs/screenshots/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const NS = 'Microsoft.OData.SampleService.Models.TripPin';

const server = await preview({ preview: { port: 4175, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1360, height: 820 },
    colorScheme: 'light',
  });
  const base = 'http://localhost:4175/';
  await page.goto(base);
  await page.getByLabel('Choose a metadata file').setInputFiles('fixtures/trippin.xml');
  const tree = page.getByRole('tree', { name: 'Model elements' });
  await tree.getByRole('treeitem', { name: 'Entity Types' }).click();
  await tree.getByRole('treeitem', { name: 'Person', exact: true }).click();
  await page.getByRole('table', { name: 'Properties', exact: true }).waitFor();
  await page.screenshot({ path: `${OUT}entity.png` });

  await page.getByRole('group', { name: 'Detail for all views' }).getByText('Technical').click();
  await page.getByRole('tab', { name: 'Source' }).click();
  await page.locator('.cm-oe-link').first().waitFor();
  await page.screenshot({ path: `${OUT}technical.png` });
  await page.getByRole('group', { name: 'Detail for all views' }).getByText('Friendly').click();

  await page.getByRole('button', { name: 'Show relationships' }).click();
  const figure = page.getByRole('figure', { name: `Relationships of ${NS}.Person` });
  await figure.getByTitle('Trip', { exact: true }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}diagram.png` });

  await page.keyboard.press('Control+k');
  await page.keyboard.type('air');
  await page.getByRole('option').first().waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}search.png` });
} finally {
  await browser.close();
  await server.close();
}
