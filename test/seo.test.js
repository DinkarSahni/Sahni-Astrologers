import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pageMetadata, publicOrigin, renderPublicPage, robotsText, sitemapXml } from '../server/seo.js';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const production = { nodeEnv: 'production', siteUrl: 'https://practice.example.org' };

test('public metadata uses the configured HTTPS origin and keeps booking pages out of search', () => {
  const page = renderPublicPage(html, production, '/contact');
  assert.equal(page.status, 200);
  assert.match(page.html, /<title>Sahni Astrologers — Contact &amp; Directions<\/title>/);
  assert.match(page.html, /rel="canonical" href="https:\/\/practice\.example\.org\/contact"/);
  assert.match(page.html, /property="og:url" content="https:\/\/practice\.example\.org\/contact"/);
  assert.equal(page.robots, 'index, follow');
  const booking = renderPublicPage(html, production, '/booking');
  assert.equal(booking.robots, 'noindex, nofollow');
  const missing = renderPublicPage(html, production, '/services/not-a-service');
  assert.equal(missing.status, 404);
  assert.doesNotMatch(missing.html, /rel="canonical"/);
  assert.equal(pageMetadata('/services/marriage').title, 'Sahni Astrologers — Marriage Matching');
  assert.match(renderPublicPage(html, production, '/disclaimer').html, /<title>Sahni Astrologers — Astrology &amp; Chart Disclaimer<\/title>/);
});

test('development and local origins never advertise a made-up public website', () => {
  for (const config of [
    { nodeEnv: 'test', siteUrl: 'https://practice.example.org' },
    { nodeEnv: 'production', siteUrl: 'http://localhost:3000' },
    { nodeEnv: 'production', siteUrl: 'https://localhost' },
    { nodeEnv: 'production', siteUrl: 'https://127.0.0.1' },
    { nodeEnv: 'production', siteUrl: 'https://staging.invalid' },
    { nodeEnv: 'production', siteUrl: 'https://name:password@practice.example.org' },
  ]) {
    assert.equal(publicOrigin(config), null);
    const result = renderPublicPage(html, config, '/');
    assert.equal(result.robots, 'noindex, nofollow');
    assert.doesNotMatch(result.html, /rel="canonical"|name="site-origin"/);
    assert.equal(sitemapXml(config), null);
    assert.equal(robotsText(config), 'User-agent: *\nDisallow: /\n');
  }
});

test('search discovery includes genuine service pages and excludes private operations', () => {
  const sitemap = sitemapXml(production);
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  assert.equal(locations.length, 14);
  assert.equal(new Set(locations).size, 14);
  assert.ok(locations.includes('https://practice.example.org/services/teva-physical'));
  assert.ok(locations.includes('https://practice.example.org/disclaimer'));
  assert.ok(locations.every(url => !/admin|api\/|booking|[?#]/.test(url)));
  assert.match(robotsText(production), /Disallow: \/api\//);
  assert.match(robotsText(production), /Disallow: \/admin/);
  assert.match(robotsText(production), /Sitemap: https:\/\/practice\.example\.org\/sitemap.xml/);
  assert.match(html, /itemtype="https:\/\/schema.org\/LocalBusiness"/);
  assert.doesNotMatch(html, /itemprop="(?:aggregateRating|ratingValue|reviewCount)"/);
});
