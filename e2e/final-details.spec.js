import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('footer contact details, source social link and policy routes work at every screen size', async ({ page }) => {
  for (const [width, height] of [[1440, 1000], [768, 900], [390, 844], [320, 700]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/contact');
    const formBottomGap = await page.locator('#contact-form').evaluate(form => form.getBoundingClientRect().bottom - form.querySelector('#contact-submit').getBoundingClientRect().bottom);
    expect(formBottomGap).toBeLessThan(140);
    const footer = page.locator('.site-footer');
    await expect(footer).toContainText('Sahni Astrologers. All rights reserved.');
    await expect(footer).toContainText('144008');
    await expect(footer.getByRole('link', { name: 'Instagram', exact: true })).toHaveAttribute('href', 'https://www.instagram.com/sahniastrologers/');
    await expect(footer.getByRole('link', { name: '+91 94652 45577', exact: true })).toHaveAttribute('href', 'tel:+919465245577');
    const year = await page.locator('#copyright-year').evaluate(element => ({ display: getComputedStyle(element).display, year: element.textContent }));
    expect(year.display).toBe('inline');
    expect(year.year).toBe(String(new Date().getFullYear()));
    await footer.getByRole('link', { name: 'Instagram', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.locator('.whatsapp-float')).toBeHidden();
    await footer.getByRole('link', { name: 'Astrology disclaimer' }).click();
    await expect(page).toHaveURL('/disclaimer');
    await expect(page.locator('#page-disclaimer')).toBeVisible();
    await expect(page.locator('#page-disclaimer')).toContainText('not scientific predictions or guarantees');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('Google Maps makes no request until chosen and retains precise directions as a fallback', async ({ page }) => {
  const mapRequests = [];
  await page.route('https://www.google.com/maps/embed?**', route => {
    mapRequests.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Map test</title><p>Map area</p>' });
  });
  await page.goto('/contact');
  await expect(page.locator('#google-map-stage iframe')).toHaveCount(0);
  expect(mapRequests).toEqual([]);
  await expect(page.getByRole('link', { name: 'Get directions', exact: true }).last()).toHaveAttribute('href', /destination=31\.3704301%2C75\.5466757/);
  await page.locator('#load-google-map').click();
  await expect(page.locator('#google-map-stage iframe')).toHaveAttribute('title', 'Google Maps location of Sahni Astrologers');
  await expect.poll(() => mapRequests.length).toBe(1);
  expect(mapRequests[0]).toContain('0x391a518b76dec3fb%3A0xdf0e60998a59714f');
  await expect(page.locator('#google-map-status')).toContainText('If it is unavailable');
  await expect(page.getByRole('link', { name: 'Open our Google listing' })).toHaveAttribute('href', /0xdf0e60998a59714f/);
  await page.locator('.site-footer').getByRole('link', { name: 'Privacy policy' }).click();
  await expect(page.locator('#page-privacy')).toContainText('Google map loads only when you choose');
});

test('single-file preview supports the footer policies and map without background requests', async ({ page }) => {
  const previewUrl = 'https://preview.invalid/final.html';
  const html = await readFile(new URL('../preview/Sahni-Astrologers-Final.html', import.meta.url), 'utf8');
  const requests = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url === previewUrl) return route.fulfill({ contentType: 'text/html', body: html });
    requests.push(url);
    if (url.startsWith('https://www.google.com/maps/embed?')) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Map test</title>' });
    return route.abort();
  });
  await page.goto(previewUrl);
  const footer = page.locator('.site-footer');
  await footer.getByRole('link', { name: 'Astrology disclaimer' }).click();
  await expect(page.locator('#page-disclaimer')).toBeVisible();
  await expect(page).toHaveURL(`${previewUrl}#/disclaimer`);
  await footer.getByRole('link', { name: 'Hours & directions' }).click();
  await expect(page.locator('#page-contact')).toBeVisible();
  expect(requests).toEqual([]);
  await page.locator('#load-google-map').click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toContain('https://www.google.com/maps/embed?');
  expect(errors).toEqual([]);
});

test('server delivers route-specific metadata before scripts and protects development search discovery', async ({ request }) => {
  const contact = await request.get('/contact?reference=private-example-reference');
  expect(contact.status()).toBe(200);
  expect(contact.headers()['x-robots-tag']).toBe('noindex, nofollow');
  const source = await contact.text();
  expect(source).toContain('<title>Sahni Astrologers — Contact &amp; Directions</title>');
  expect(source).not.toContain('private-example-reference');
  expect(source).not.toContain('rel="canonical"');
  expect((await request.get('/disclaimer')).status()).toBe(200);
  expect((await request.get('/services/unknown-service')).status()).toBe(404);
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n');
  expect((await request.get('/sitemap.xml')).status()).toBe(404);
});
