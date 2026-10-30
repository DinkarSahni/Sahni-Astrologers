import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const viewerUrl = 'https://viewer.invalid/';
let html;

test.beforeAll(async () => {
  execFileSync(process.execPath, ['scripts/preview.mjs'], { cwd: root, stdio: 'pipe' });
  html = await readFile(resolve(root, 'preview/Sahni-Astrologers.html'), 'utf8');
});

test('standalone packaging preserves valid inline JavaScript', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
  expect(scripts).toHaveLength(1);
  // Replacement-token sequences in bundled code must survive HTML packaging.
  expect(() => new Script(scripts[0][1], { filename: 'standalone-inline.js' })).not.toThrow();
});

test('restricted embedded preview supports navigation, local charts, search, and unsent enquiries', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const unexpected = [];
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.route('**/*', route => {
    if (route.request().url() !== viewerUrl) {
      unexpected.push(route.request().url());
      return route.abort();
    }
    // An opaque-origin srcdoc under an HTTPS viewer reproduces file-preview
    // restrictions. Do not grant forms, same-origin access, or modal permissions.
    const source = JSON.stringify(html).replaceAll('<', '\\u003c');
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><title>File viewer</title><style>html,body{margin:0;height:100%}iframe{display:block;border:0;width:100%;height:100%}</style></head><body><iframe id="site-preview" title="Website preview" sandbox="allow-scripts"></iframe><script>document.getElementById('site-preview').srcdoc=${source};</script></body></html>`,
    });
  });
  await page.goto(viewerUrl);
  const embedded = page.frameLocator('#site-preview');
  await expect(embedded.locator('#entry-screen')).toHaveCount(0);
  await expect(embedded.locator('#page-home')).toBeVisible();
  const frame = await (await page.locator('#site-preview').elementHandle()).contentFrame();
  expect(await frame.evaluate(() => location.origin)).toBe('null');
  expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();

  const navigate = async name => {
    await embedded.locator('#menu-toggle').click();
    await embedded.locator('#main-nav').getByRole('link', { name, exact: true }).click();
  };
  await navigate('Birth chart');
  await expect(embedded.locator('#page-birth-chart')).toBeVisible();
  expect(frame.url()).toBe('about:srcdoc#/birth-chart');
  await embedded.locator('#chart-language').selectOption('hi');
  await embedded.locator('#chart-city').selectOption('jalandhar');
  await embedded.locator('#chart-date').fill('1990-01-01');
  await embedded.locator('#chart-time').fill('10:20');
  await embedded.locator('#chart-submit').click();
  await expect(embedded.locator('#chart-result')).toBeVisible();
  await expect(embedded.locator('#chart-result')).toHaveAttribute('lang', 'hi');
  await expect(embedded.locator('#chart-result svg')).toHaveCount(2);
  await expect(embedded.locator('#chart-result table').first().locator('tbody tr')).toHaveCount(9);

  await navigate('FAQ');
  await expect(embedded.locator('#page-faq')).toBeVisible();
  await embedded.locator('#faq-search').fill('payment');
  await expect(embedded.locator('#faq-list details:visible')).toHaveCount(2);
  await expect(embedded.locator('#faq-results-count')).toHaveText('2 answers found');
  expect(frame.url()).toBe('about:srcdoc#/faq?q=payment');

  await navigate('Contact');
  await embedded.locator('#contact-name').fill('Preview Test');
  await embedded.locator('#contact-details').fill('test@example.invalid');
  await embedded.locator('#contact-message').fill('A question about a consultation.');
  await embedded.locator('#contact-form input[type="checkbox"]').check();
  await embedded.locator('#contact-submit').click();
  await expect(embedded.locator('#contact-status')).toContainText('Nothing has been sent');
  await expect(embedded.locator('#contact-status a')).toHaveAttribute('href', /^https:\/\/wa\.me\/919465245577\?text=/);
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
