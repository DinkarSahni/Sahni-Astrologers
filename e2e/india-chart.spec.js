import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cities } from '../public/chart-cities.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const plain = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const indianPlace = name => cities.find(city => city.country === 'IN'
  && plain(city.placeName || city.name.split(',')[0]) === plain(name));

function monitor(page) {
  const writes = [], external = [], errors = [];
  page.on('request', request => {
    if (request.method() === 'POST') writes.push(request.url());
    if (!request.url().startsWith('http://localhost:4173/')) external.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  return { writes, external, errors };
}

async function choosePlace(scope, record, query) {
  await scope.locator('#chart-place-search').fill(query);
  await expect(scope.locator(`#chart-city option[value="${record.id}"]`)).toHaveCount(1);
  await scope.locator('#chart-city').selectOption(record.id);
}

async function fillBirth(scope) {
  await scope.locator('#chart-date').fill('2000-01-01');
  await scope.locator('#chart-time').fill('17:30:45');
}

test('nationwide search selects actual birth places across mainland and island regions', async ({ page }) => {
  const observed = monitor(page);
  await page.route('https://**/*', route => route.abort());
  await page.goto('/birth-chart');
  await expect(page.locator('#chart-region option')).toHaveCount(37);
  await fillBirth(page);
  for (const name of ['Itanagar', 'Leh', 'Kavaratti']) {
    const place = indianPlace(name);
    expect(place, `${name} must be included with its Indian region`).toBeTruthy();
    await choosePlace(page, place, name);
    await page.locator('#chart-submit').click();
    const result = page.locator('#chart-result');
    await expect(result).toBeVisible();
    await expect(result.locator('.lead')).toContainText(place.name);
    await expect(result).toContainText(`${place.lat.toFixed(4)}°, ${place.lon.toFixed(4)}°`);
    await expect(result).toHaveAttribute('data-calculation-utc', '2000-01-01T12:00:45.000Z');
    await expect(result.locator('.chart-panchang dt')).toHaveCount(4);
    expect(await result.evaluate(element => element.getBoundingClientRect().top >= document.querySelector('.site-header').getBoundingClientRect().bottom)).toBeTruthy();
    await expect(result.locator('table').first().locator('tbody tr')).toHaveCount(9);
    await expect(page.locator('#chart-error')).toBeEmpty();
  }
  expect(observed).toEqual({ writes: [], external: [], errors: [] });
});

test('state filtering distinguishes places with the same name and clears a stale selection', async ({ page }) => {
  await page.goto('/birth-chart');
  const rampurs = cities.filter(city => city.country === 'IN' && plain(city.placeName || '') === 'rampur');
  const distinct = rampurs.filter((city, index) => rampurs.findIndex(candidate => candidate.region === city.region) === index);
  expect(distinct.length).toBeGreaterThan(1);
  await page.locator('#chart-place-search').fill('Rampur');
  for (const place of distinct.slice(0, 2)) {
    await page.locator('#chart-region').selectOption(place.region);
    await expect(page.locator(`#chart-city option[value="${place.id}"]`)).toHaveCount(1);
    await page.locator('#chart-city').selectOption(place.id);
    await expect(page.locator('#chart-city')).toHaveValue(place.id);
  }
  await page.locator('#chart-place-search').fill('a-place-that-does-not-exist-729');
  await expect(page.locator('#chart-city')).toHaveValue('');
  await expect(page.locator('#chart-city option')).toHaveCount(1);
  await fillBirth(page);
  await page.locator('#chart-submit').click();
  await expect(page.locator('#chart-result')).toBeHidden();
  expect(await page.locator('#chart-city').evaluate(select => select.checkValidity())).toBe(false);
});

test('exact Indian coordinates support village births, validate bounds, and retain seconds in Hindi charts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const observed = monitor(page);
  await page.route('https://**/*', route => route.abort());
  await page.goto('/birth-chart');
  await page.locator('#chart-mode-coordinates').click();
  await expect(page.locator('#chart-mode-coordinates')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#chart-custom-place').fill('My village, Himachal Pradesh');
  await fillBirth(page);
  await page.locator('#chart-latitude').fill('51.5');
  await page.locator('#chart-longitude').fill('77.1768');
  await page.locator('#chart-submit').click();
  await expect(page.locator('#chart-result')).toBeHidden();
  expect(await page.locator('#chart-latitude').evaluate(input => input.validity.rangeOverflow)).toBe(true);

  await page.locator('#chart-latitude').fill('32.1154');
  await page.locator('#chart-submit').click();
  const result = page.locator('#chart-result');
  await expect(result).toBeVisible();
  await expect(result.locator('.lead')).toContainText('My village, Himachal Pradesh');
  await expect(result).toContainText('32.1154°, 77.1768°');
  await expect(result).toHaveAttribute('data-calculation-utc', '2000-01-01T12:00:45.000Z');
  await expect(result.locator('.chart-panchang dt')).toHaveCount(4);
  await result.locator('button[data-chart-language="hi"]').click();
  await expect(result).toHaveAttribute('lang', 'hi');
  await expect(result).toHaveAttribute('data-calculation-utc', '2000-01-01T12:00:45.000Z');
  await expect(result).toContainText('३२.११५४°, ७७.१७६८°');
  await expect(result.locator('svg')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(observed).toEqual({ writes: [], external: [], errors: [] });
});

test('birth details edited while the calculation module loads cannot render an earlier record', async ({ page }) => {
  const observed = monitor(page);
  let releaseModule, markRequested;
  const moduleReleased = new Promise(resolve => { releaseModule = resolve; });
  const moduleRequested = new Promise(resolve => { markRequested = resolve; });
  await page.route('**/chart-engine.js', async route => {
    markRequested();
    await moduleReleased;
    await route.continue();
  });
  await page.goto('/birth-chart');
  await page.locator('#chart-name').fill('Earlier record');
  await page.locator('#chart-city').selectOption('jalandhar');
  await fillBirth(page);
  await page.locator('#chart-submit').click();
  await moduleRequested;
  try {
    await expect(page.locator('#chart-submit')).toBeDisabled();
    await page.locator('#chart-name').fill('Updated birth record');
    await page.locator('#chart-date').fill('2001-02-03');
    await page.locator('#chart-time').fill('09:10:11');
    await choosePlace(page, indianPlace('Kavaratti'), 'Kavaratti');
    await expect(page.locator('#chart-result')).toBeHidden();
  } finally { releaseModule(); }
  const result = page.locator('#chart-result');
  await expect(result).toBeVisible();
  await expect(result.locator('h2')).toContainText('Updated birth record');
  await expect(result).not.toContainText('Earlier record');
  await expect(result).toHaveAttribute('data-calculation-utc', '2001-02-03T03:40:11.000Z');
  await expect(result).toHaveAttribute('data-birth-place-id', indianPlace('Kavaratti').id);
  await expect(result.locator('.lead')).toContainText(indianPlace('Kavaratti').name);
  expect(observed).toEqual({ writes: [], external: [], errors: [] });
});

test('same-name places within one district remain distinguishable and retain their own coordinates', async ({ page }) => {
  const ramgarhs = cities.filter(city => city.country === 'IN' && plain(city.placeName || '') === 'ramgarh'
    && city.region === 'Rajasthan' && city.district === 'Sikar District');
  expect(ramgarhs).toHaveLength(2);
  await page.goto('/birth-chart');
  await page.locator('#chart-place-search').fill('Ramgarh');
  await page.locator('#chart-region').selectOption('Rajasthan');
  const labels = [];
  for (const place of ramgarhs) {
    const option = page.locator(`#chart-city option[value="${place.id}"]`);
    await expect(option).toHaveCount(1);
    labels.push(await option.textContent());
  }
  expect(new Set(labels).size).toBe(2);
  await fillBirth(page);
  for (const place of ramgarhs) {
    await page.locator('#chart-city').selectOption(place.id);
    await page.locator('#chart-submit').click();
    const result = page.locator('#chart-result');
    await expect(result).toHaveAttribute('data-birth-place-id', place.id);
    await expect(result).toContainText(`${place.lat.toFixed(4)}°, ${place.lon.toFixed(4)}°`);
  }
});

test('an unavailable place directory keeps clear recovery guidance instead of a loading message', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/chart-cities.js', route => route.abort('failed'));
  await page.goto('/birth-chart');
  const status = page.locator('#chart-place-status');
  await expect(status).toContainText('could not load');
  await expect(status).toContainText('Reload');
  await fillBirth(page);
  await page.locator('#chart-submit').click();
  await expect(page.locator('#chart-submit')).toBeEnabled();
  await expect(status).toContainText('could not load');
  await expect(status).toContainText('Reload');
  await expect(status).not.toContainText('Loading');
  await expect(page.locator('#chart-error')).toContainText(/reload/i);
  await expect(page.locator('#chart-error')).not.toContainText(/https?:|chart-cities\.js|Failed to fetch/i);
  await expect(page.locator('#chart-result')).toBeHidden();
  expect(errors).toEqual([]);
});

test('nationwide place search and exact-coordinate charts work in an offline restricted viewer', async ({ page }) => {
  execFileSync(process.execPath, ['scripts/preview.mjs'], { cwd: root, stdio: 'pipe' });
  const html = await readFile(resolve(root, 'preview/Sahni-Astrologers-Final.html'), 'utf8');
  const viewerUrl = 'https://india-viewer.invalid/';
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (route.request().url() !== viewerUrl) {
      external.push(route.request().url());
      return route.abort();
    }
    const source = JSON.stringify(html).replaceAll('<', '\\u003c');
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><style>html,body{margin:0;height:100%}iframe{display:block;border:0;width:100%;height:100%}</style></head><body><iframe id="site" title="Website preview" sandbox="allow-scripts"></iframe><script>document.getElementById('site').srcdoc=${source};</script></body></html>`,
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(viewerUrl);
  const site = page.frameLocator('#site');
  await expect(site.locator('#page-home')).toBeVisible();
  await expect(site.locator('#entry-screen')).toHaveCount(0);
  await site.locator('#menu-toggle').click();
  await site.locator('#main-nav').getByRole('link', { name: 'Birth chart', exact: true }).click();
  const kavaratti = indianPlace('Kavaratti');
  expect(kavaratti).toBeTruthy();
  await choosePlace(site, kavaratti, 'Kavaratti');
  await fillBirth(site);
  await site.locator('#chart-submit').click();
  await expect(site.locator('#chart-result .lead')).toContainText(kavaratti.name);
  await site.locator('#chart-mode-coordinates').click();
  await site.locator('#chart-custom-place').fill('Village birth record');
  await site.locator('#chart-latitude').fill('32.1154');
  await site.locator('#chart-longitude').fill('77.1768');
  await site.locator('#chart-submit').click();
  await expect(site.locator('#chart-result .lead')).toContainText('Village birth record');
  await expect(site.locator('#chart-result')).toHaveAttribute('data-calculation-utc', '2000-01-01T12:00:45.000Z');
  await expect(site.locator('#chart-result .chart-panchang dt')).toHaveCount(4);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
