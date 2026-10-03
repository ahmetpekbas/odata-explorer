import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const GRAPH = 'fixtures/large/graph-beta.xml';
/** The longest the main thread may be blocked while a file loads, in ms. */
const LONG_TASK_BUDGET = 200;

test.skip(!existsSync(GRAPH), 'Run `npm run fetch:perf` to download the Graph document.');

test('loading Microsoft Graph never blocks the main thread for over 200 ms', async ({ page }) => {
  // A script string: the DOM types are not available to this Node project.
  await page.addInitScript(`
    globalThis.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) globalThis.__longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
  `);
  await page.goto('./');
  // Page start-up is not part of the budget; only the load is.
  await expect(page.getByRole('heading', { name: 'OData Explorer' })).toBeVisible();
  await page.evaluate('globalThis.__longTasks = []');

  await page.getByLabel('Choose a metadata file').setInputFiles(GRAPH);
  await expect(page.getByRole('navigation', { name: 'Navigator' })).toBeVisible({
    timeout: 60_000,
  });
  // Let rendering and the search index settle, then read what the observer recorded.
  await page.waitForTimeout(1000);
  const tasks = await page.evaluate<number[]>('globalThis.__longTasks');
  console.log(`long tasks during load (ms): ${tasks.map(Math.round).join(', ') || 'none'}`);
  expect(Math.max(0, ...tasks)).toBeLessThanOrEqual(LONG_TASK_BUDGET);
});

test('a loaded Microsoft Graph document is searchable and opens its types', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Choose a metadata file').setInputFiles(GRAPH);
  await expect(page.getByRole('navigation', { name: 'Navigator' })).toBeVisible({
    timeout: 60_000,
  });

  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Search the model' }).fill('user');
  await expect(page.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: 'user', exact: true })).toBeVisible();
});
