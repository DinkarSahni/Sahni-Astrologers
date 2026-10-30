import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const previewUrl = 'https://preview.invalid/index.html';
let html;

test.beforeAll(async () => {
  execFileSync(process.execPath, ['scripts/preview.mjs'], { cwd: root, stdio: 'pipe' });
  html = await readFile(resolve(root, 'preview/Sahni-Astrologers.html'), 'utf8');
});

async function openPreview(page) {
  const unexpected = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (route.request().url() === previewUrl) return route.fulfill({ contentType: 'text/html', body: html });
    unexpected.push(route.request().url());
    return route.abort();
  });
  await page.goto(previewUrl);
  await page.evaluate(() => document.fonts.ready);
  return { unexpected, errors };
}

test('standalone HTML embeds styles and fonts, fits mobile, and navigates without asset requests', async ({ page }) => {
  const { unexpected, errors } = await openPreview(page);
  await expect(page.locator('meta[name="site-mode"]')).toHaveAttribute('content', 'standalone-preview');
  await expect(page.locator('#page-home')).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(244, 239, 230)');
  const fonts = await page.evaluate(() => [...document.fonts].map(font => ({ family: font.family, status: font.status })));
  expect(fonts.some(font => font.family.includes('Playfair Display') && font.status === 'loaded')).toBeTruthy();
  expect(fonts.some(font => font.family.includes('DM Sans') && font.status === 'loaded')).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.locator('#menu-toggle').click();
  await page.locator('#main-nav').getByRole('link', { name: 'Birth chart', exact: true }).click();
  await expect(page).toHaveURL(`${previewUrl}#/birth-chart`);
  await expect(page.locator('#page-birth-chart')).toBeVisible();
  await page.locator('#chart-language').selectOption('hi');
  await page.goBack();
  await expect(page.locator('#page-home')).toBeVisible();
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test('standalone chart works offline and payment/contact actions cannot pretend to submit', async ({ page }) => {
  const { unexpected, errors } = await openPreview(page);
  await page.evaluate(() => { location.hash = '/birth-chart'; });
  await expect(page.locator('#page-birth-chart')).toBeVisible();
  await page.locator('#chart-language').selectOption('hi');
  await page.locator('#chart-city').selectOption('jalandhar');
  await page.locator('#chart-date').fill('1990-01-01');
  await page.locator('#chart-time').fill('10:20');
  await page.locator('#chart-submit').click();
  await expect(page.locator('#chart-result')).toBeVisible();
  await expect(page.locator('#chart-result')).toHaveAttribute('lang', 'hi');
  expect(await page.evaluate(async () => (await document.fonts.load('16px "Noto Sans Devanagari"', 'सूर्य')).length)).toBeGreaterThan(0);
  await expect(page.locator('#chart-result svg')).toHaveCount(2);
  await expect(page.locator('#chart-result table').first().locator('tbody tr')).toHaveCount(9);
  await page.evaluate(() => { location.hash = '/booking'; });
  await expect(page.locator('#booking-submit')).toBeDisabled();
  await expect(page.locator('#payment-availability')).toContainText('Local website preview');
  await page.evaluate(() => { location.hash = '/contact'; });
  await page.locator('#contact-name').fill('Offline Test');
  await page.locator('#contact-details').fill('test@example.invalid');
  await page.locator('#contact-message').fill('A question about a consultation.');
  await page.locator('#contact-form input[type="checkbox"]').check();
  await page.locator('#contact-submit').click();
  await expect(page.locator('#contact-status')).toContainText('Nothing has been sent');
  await expect(page.locator('#contact-status a')).toHaveAttribute('href', /^https:\/\/wa\.me\/919465245577\?text=/);
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

for (const compatibility of ['missing-observers', 'legacy-media-events', 'missing-media-query']) {
  test(`standalone startup and core controls survive ${compatibility}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(mode => {
      if (mode === 'missing-observers') {
        window.ResizeObserver = undefined;
        window.IntersectionObserver = undefined;
        window.MutationObserver = undefined;
      } else if (mode === 'missing-media-query') {
        window.matchMedia = undefined;
      } else {
        const nativeMatch = window.matchMedia.bind(window);
        window.matchMedia = query => {
          const result = nativeMatch(query);
          Object.defineProperty(result, 'addEventListener', { value: undefined });
          Object.defineProperty(result, 'removeEventListener', { value: undefined });
          return result;
        };
      }
    }, compatibility);
    const { unexpected, errors } = await openPreview(page);
    await expect(page.locator('#page-home')).toBeVisible();
    await expect(page.locator('#booking-service option')).toHaveCount(5);
    await page.locator('#reviews-next').click();
    await expect.poll(() => page.locator('#reviews-track').evaluate(element => element.scrollLeft)).toBeGreaterThan(100);
    await page.locator('#main-nav').getByRole('link', { name: 'Birth chart', exact: true }).click();
    await expect(page.locator('#page-birth-chart')).toBeVisible();
    await page.locator('#chart-city').selectOption('jalandhar');
    await page.locator('#chart-date').fill('1990-01-01');
    await page.locator('#chart-time').fill('10:20');
    await page.locator('#chart-submit').click();
    await expect(page.locator('#chart-result')).toBeVisible();
    expect(unexpected).toEqual([]);
    expect(errors).toEqual([]);
  });
}
