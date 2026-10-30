import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function monitor(page) {
  const writes = [], external = [], errors = [], numerical = [];
  page.on('request', request => {
    if (request.method() === 'POST') writes.push(request.url());
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://localhost:4173/')) external.push(request.url());
    if (/\/(chart-engine|astronomy-engine)\.js$/.test(request.url())) numerical.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  return { writes, external, errors, numerical };
}

async function fillBirth(scope, time = '17:30:45') {
  await scope.locator('#chart-name').fill('Offline chart test');
  await scope.locator('#chart-city').selectOption('jalandhar');
  await scope.locator('#chart-date').fill('2000-01-01');
  await scope.locator('#chart-time').fill(time);
}

async function openSettings(scope) {
  const disclosure = scope.locator('#chart-calculation-options');
  if (await disclosure.getAttribute('open') === null) await disclosure.locator('summary').click();
}

async function downloadRecord(page) {
  const downloading = page.waitForEvent('download');
  await page.locator('#chart-export').click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^Sahni-Astrologers-.*\.json$/);
  expect(await download.failure()).toBeNull();
  return JSON.parse(await readFile(await download.path(), 'utf8'));
}

test('advanced choices change the calculation while chart layouts and divisions reuse the numerical record', async ({ page }) => {
  const observed = monitor(page);
  await page.route('https://**/*', route => route.abort());
  await page.goto('/birth-chart');
  await fillBirth(page);
  await page.locator('#chart-submit').click();
  const result = page.locator('#chart-result');
  await expect(result).toBeVisible();
  const initial = await downloadRecord(page);
  expect(initial.settings.nodeMode).toBe('mean');
  expect(initial.settings.dashaYearDays).toBe(365.25);
  expect(initial.results.planets).toHaveLength(9);
  expect(Object.keys(initial.results.divisions)).toHaveLength(16);

  const numericalAfterCalculation = [...observed.numerical];
  await openSettings(page);
  await page.locator('#chart-style').selectOption('south');
  await expect(result).toBeVisible();
  await expect(result.locator('svg[data-chart-style="south"]')).toHaveCount(2);
  await page.locator('#chart-division').selectOption('D10');
  await expect(result.locator('svg[data-division="D10"]')).toHaveCount(1);
  await expect(page.locator('#chart-division-table tbody tr')).toHaveCount(9);
  await result.locator('button[data-chart-language="hi"]').click();
  await expect(result).toHaveAttribute('lang', 'hi');
  await expect(page.locator('#chart-division')).toHaveValue('D10');
  await expect(result.locator('svg[data-chart-style="south"]')).toHaveCount(2);
  await result.locator('button[data-chart-language="en"]').click();
  const displayed = await downloadRecord(page);
  expect(displayed.presentation).toMatchObject({ language: 'en', style: 'south', selectedDivision: 'D10' });
  expect(displayed.results.planets).toEqual(initial.results.planets);
  expect(displayed.birth).toEqual(initial.birth);
  expect(observed.numerical).toEqual(numericalAfterCalculation);

  await openSettings(page);
  await page.locator('#chart-node-mode').selectOption('true');
  await expect(result).toBeHidden();
  await page.locator('#chart-dasha-year').selectOption('360');
  await page.locator('#chart-submit').click();
  await expect(result).toBeVisible();
  const advanced = await downloadRecord(page);
  expect(advanced.settings.nodeMode).toBe('true');
  expect(advanced.settings.dashaYearDays).toBe(360);
  expect(advanced.settings.node).toMatch(/approximate.*true/i);
  expect(advanced.birth).toEqual(initial.birth);
  const planet = (record, name) => record.results.planets.find(body => body.name === name);
  expect(planet(advanced, 'Rahu').longitude).not.toBe(planet(initial, 'Rahu').longitude);
  expect(planet(advanced, 'Sun').longitude).toBe(planet(initial, 'Sun').longitude);
  expect(planet(advanced, 'Moon').longitude).toBe(planet(initial, 'Moon').longitude);
  expect(advanced.results.dashas[0].end).not.toBe(initial.results.dashas[0].end);
  expect(observed.writes).toEqual([]);
  expect(observed.external).toEqual([]);
  expect(observed.errors).toEqual([]);
});

test('pre-dawn births distinguish solar Vara from civil weekday and show three Dasha levels', async ({ page }) => {
  const observed = monitor(page);
  await page.route('https://**/*', route => route.abort());
  await page.goto('/birth-chart');
  await fillBirth(page, '04:00:00');
  await page.locator('#chart-submit').click();
  const result = page.locator('#chart-result');
  await expect(result).toBeVisible();
  await expect(page.locator('#chart-solar-day')).toContainText('Friday');
  await expect(page.locator('#chart-panchang-transitions dt')).toHaveCount(4);
  const record = await downloadRecord(page);
  expect(record.results.panchang.weekday.name).toBe('Saturday');
  expect(record.results.solarDay.vara.name).toBe('Friday');
  const birth = Date.parse(record.birth.utc);
  expect(Date.parse(record.results.solarDay.previousSunrise)).toBeLessThan(birth);
  expect(Date.parse(record.results.solarDay.nextSunrise)).toBeGreaterThan(birth);
  for (const name of ['tithi', 'nakshatra', 'yoga', 'karana']) {
    expect(Date.parse(record.results.panchangTransitions[name].endsAt)).toBeGreaterThan(birth);
  }
  const major = result.locator('.dasha-list > details').first();
  if (await major.getAttribute('open') === null) await major.locator(':scope > summary').click();
  const subperiod = major.locator('.dasha-subperiod').first();
  await expect(subperiod).toBeVisible();
  if (await subperiod.getAttribute('open') === null) await subperiod.locator(':scope > summary').click();
  await expect(subperiod.locator('table tbody tr').first()).toBeVisible();
  const first = record.results.dashas[0].antardashas[0];
  expect(first.pratyantardashas.length).toBeGreaterThan(0);
  expect(first.pratyantardashas[0].start).toBe(first.start);
  expect(first.pratyantardashas.at(-1).end).toBe(first.end);
  expect(observed.writes).toEqual([]);
  expect(observed.external).toEqual([]);
  expect(observed.errors).toEqual([]);
});

test('the standalone restricted viewer runs advanced charts locally and explains blocked downloads', async ({ page }) => {
  execFileSync(process.execPath, ['scripts/preview.mjs'], { cwd: root, stdio: 'pipe' });
  const html = await readFile(resolve(root, 'preview/Sahni-Astrologers-Final.html'), 'utf8');
  const viewerUrl = 'https://advanced-viewer.invalid/';
  const external = [], errors = [], downloads = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('download', download => downloads.push(download.suggestedFilename()));
  await page.route('**/*', route => {
    if (route.request().url() !== viewerUrl) { external.push(route.request().url()); return route.abort(); }
    const source = JSON.stringify(html).replaceAll('<', '\\u003c');
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><style>html,body{margin:0;height:100%}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><iframe id="site" title="Website preview" sandbox="allow-scripts"></iframe><script>document.getElementById('site').srcdoc=${source};</script></body></html>` });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(viewerUrl);
  const site = page.frameLocator('#site');
  await expect(site.locator('#page-home')).toBeVisible();
  await expect(site.locator('#entry-screen')).toHaveCount(0);
  await site.locator('#menu-toggle').click();
  await site.locator('#main-nav').getByRole('link', { name: 'Birth chart', exact: true }).click();
  await fillBirth(site);
  await openSettings(site);
  await site.locator('#chart-node-mode').selectOption('true');
  await site.locator('#chart-dasha-year').selectOption('360');
  await site.locator('#chart-style').selectOption('south');
  await site.locator('#chart-submit').click();
  await expect(site.locator('#chart-result')).toBeVisible();
  await site.locator('#chart-division').selectOption('D60');
  await site.locator('#chart-result button[data-chart-language="hi"]').click();
  await expect(site.locator('#chart-division')).toHaveValue('D60');
  await expect(site.locator('#chart-result svg[data-chart-style="south"]')).toHaveCount(2);
  await expect(site.locator('#chart-result svg[data-division="D60"]')).toHaveCount(1);
  await expect(site.locator('#chart-division-table tbody tr')).toHaveCount(9);
  await expect(site.locator('#chart-panchang-transitions dt')).toHaveCount(4);
  await site.locator('#chart-export').click();
  await expect(site.locator('#chart-export-status')).toContainText(/browser|ब्राउज़र/i);
  expect(downloads).toEqual([]);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
