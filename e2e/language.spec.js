import { test, expect } from '@playwright/test';

test('chart language can be selected before calculation and toggled safely without new requests', async ({ page }) => {
  const numericalRequests = [], writes = [], errors = [];
  page.on('request', request => {
    if (/\/(chart-engine|astronomy-engine)\.js$/.test(request.url())) numericalRequests.push(request.url());
    if (request.method() === 'POST') writes.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
  await page.goto('/birth-chart');
  expect(numericalRequests).toEqual([]);
  await page.locator('#chart-language').selectOption('hi');
  await expect(page.locator('label[for="chart-city"]')).toHaveText('जन्म का शहर');
  const hostile = '<img src=x onerror="window.languageInjected=true">';
  await page.locator('#chart-name').fill(hostile);
  await page.locator('#chart-city').selectOption('jalandhar');
  await page.locator('#chart-date').fill('1990-01-01');
  await page.locator('#chart-time').fill('10:20');
  await page.locator('#chart-submit').click();
  const result = page.locator('#chart-result');
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute('lang', 'hi');
  await expect(result.locator('h2')).toContainText(hostile);
  await expect(result.locator('table').first().locator('thead th').first()).toHaveText('ग्रह');
  await expect(result.locator('table').first().locator('tbody tr')).toHaveCount(9);
  await expect(result.locator('table').first().locator('tbody tr').first()).toContainText('सूर्य');
  await expect(result.locator('svg')).toHaveCount(2);
  expect(await page.evaluate(async () => (await document.fonts.load('16px "Noto Sans Devanagari"', 'सूर्य')).length)).toBeGreaterThan(0);
  expect(await result.locator('svg text').allTextContents()).toContain('सू');
  await expect(result.locator('button[data-chart-language="hi"]')).toHaveAttribute('aria-pressed', 'true');
  const calculationUtc = await result.getAttribute('data-calculation-utc');
  const requestsAfterCalculation = [...numericalRequests];
  expect(requestsAfterCalculation.some(url => url.endsWith('/vendor/astronomy-engine.js'))).toBeTruthy();

  await result.locator('button[data-chart-language="en"]').click();
  await expect(result).toHaveAttribute('lang', 'en');
  await expect(page.locator('#chart-language')).toHaveValue('en');
  await expect(result.locator('table').first().locator('thead th').first()).toHaveText('Planet');
  await expect(result.locator('table').first().locator('tbody tr').first()).toContainText('Sun');
  await expect(result.locator('h2')).toContainText(hostile);
  await expect(result).toHaveAttribute('data-calculation-utc', calculationUtc);

  await result.locator('button[data-chart-language="hi"]').click();
  await page.evaluate(() => {
    window.print = () => {
      window.printedChart = { language: document.querySelector('#chart-result').lang, title: document.title, text: document.querySelector('#chart-result').textContent };
    };
  });
  await result.locator('#chart-print').click();
  const printed = await page.evaluate(() => window.printedChart);
  expect(printed.language).toBe('hi');
  expect(printed.title).toContain('जन्म कुंडली');
  expect(printed.text).toContain('विंशोत्तरी दशा');
  expect(await page.evaluate(() => window.languageInjected)).toBeUndefined();
  expect(numericalRequests).toEqual(requestsAfterCalculation);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
  const sharingLink = await result.locator('#chart-whatsapp').getAttribute('href');
  expect(sharingLink).toMatch(/^https:\/\/wa\.me\/919465245577\?text=/);
  expect(decodeURIComponent(sharingLink)).toContain('1990-01-01');
  await expect(result).not.toContainText(/Pandit|पंडित/i);
});
