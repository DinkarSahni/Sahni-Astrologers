import { test, expect } from '@playwright/test';

const unlocked = page => expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflowY !== 'hidden' && getComputedStyle(document.body).overflowY !== 'hidden')).toBeTruthy();

async function storyPosition(page, fraction, extra = 0) {
  return await page.evaluate(({ fraction, extra }) => {
    const section = document.querySelector('#scrollStorySection');
    const viewport = section.querySelector('.scroll-story-sticky');
    const style = getComputedStyle(section);
    const top = parseFloat(getComputedStyle(viewport).top) || 0;
    const start = section.getBoundingClientRect().top + scrollY
      + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.paddingTop) || 0) - top;
    const distance = parseFloat(style.getPropertyValue('--story-distance'));
    scrollTo({ top: start + distance * fraction + extra, behavior: 'instant' });
    return { distance, top };
  }, { fraction, extra });
}

test('vertical scrolling pins each device story, reaches the final panel, then resumes the page', async ({ page }) => {
  for (const [width, height] of [[1440, 1000], [768, 900], [390, 844], [320, 700], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const section = page.locator('#scrollStorySection');
    await expect(section).toHaveClass(/is-story-pinned/);
    const { distance, top } = await storyPosition(page, 0.5);
    expect(distance).toBeGreaterThan(width * 2);
    await expect.poll(async () => Math.abs(await page.locator('#storyTrack').evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41) + distance / 2)).toBeLessThan(1.1);
    expect(await section.locator('.scroll-story-sticky').evaluate(el => el.getBoundingClientRect().top)).toBeCloseTo(top, 0);
    await storyPosition(page, 1);
    await expect(page.locator('#story-counter')).toHaveText('4 / 4');
    expect(await section.locator('.story-panel').evaluateAll(panels => panels.every(panel => panel.scrollHeight <= panel.clientHeight + 1))).toBeTruthy();
    await storyPosition(page, 1, 260);
    await expect.poll(() => section.locator('.scroll-story-sticky').evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(top - 150);
    await storyPosition(page, 0.25);
    await expect.poll(async () => Math.abs(await page.locator('#storyTrack').evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41) + distance / 4)).toBeLessThan(1.1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});

test('reduced motion uses a short accessible horizontal story instead of the pinned effect', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#entry-screen')).toHaveCount(0);
  const section = page.locator('#scrollStorySection');
  await expect(section).toHaveClass(/is-story-reduced/);
  expect(await section.evaluate(el => el.offsetHeight)).toBeLessThan(844 * 2);
  await section.locator('.scroll-story-sticky').focus();
  await page.keyboard.press('End');
  await expect(page.locator('#story-counter')).toHaveText('4 / 4');
  expect(await section.locator('.scroll-story-sticky').evaluate(el => el.scrollLeft)).toBeGreaterThan(900);
  const controls = await section.locator('.story-controls').boundingBox();
  expect(controls.x).toBeGreaterThanOrEqual(0);
  expect(controls.x + controls.width).toBeLessThanOrEqual(391);
});

test('a fresh homepage opens directly on desktop and mobile without an entry screen', async ({ page }) => {
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 568]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.locator('#entry-screen')).toHaveCount(0);
    await expect(page.locator('#heroSection .hero-h1')).toBeVisible();
    await unlocked(page);
    expect(await page.locator('#main').evaluate(element => element.inert)).toBe(false);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width < 769) await page.locator('#menu-toggle').click();
    await page.locator('#main-nav').getByRole('link', { name: 'Birth chart', exact: true }).click();
    await expect(page.locator('#page-birth-chart')).toBeVisible();
  }
});

test('mobile touch scrolling and navigation work immediately without browser storage', async ({ page, context }) => {
  await page.addInitScript(() => {
    for (const storage of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, storage, { configurable: true, get() { throw new DOMException('Storage unavailable', 'SecurityError'); } });
    }
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const touch = await context.newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await page.goto('/');
  await expect(page.locator('#heroSection .hero-h1')).toBeVisible();
  await unlocked(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 650 }] });
  for (const nextY of [580, 490, 390, 280]) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: nextY }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(150);
  await touch.detach();
  await page.locator('#menu-toggle').click();
  await page.locator('#main-nav').getByRole('link', { name: 'Birth chart', exact: true }).click();
  await expect(page.locator('#page-birth-chart')).toBeVisible();
  expect(errors).toEqual([]);
});

test('wheel scrolling starts immediately and delayed configuration does not lock or reset the page', async ({ page }) => {
  let releaseConfig;
  const configHeld = new Promise(resolve => { releaseConfig = resolve; });
  await page.route('**/api/config', async route => { await configHeld; await route.continue(); });
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    await expect(page.locator('#heroSection .hero-h1')).toBeVisible();
    await unlocked(page);
    await page.mouse.move(720, 700);
    await page.mouse.wheel(0, 420);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(200);
    const beforeConfig = await page.evaluate(() => scrollY);
    const response = page.waitForResponse('**/api/config');
    releaseConfig();
    await response;
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(200);
    await unlocked(page);
    await page.mouse.wheel(0, 360);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(beforeConfig + 200);
  } finally { releaseConfig(); }
});

test('direct destinations and reduced-motion preferences remain immediately accessible', async ({ page }) => {
  for (const [route, destination] of [['/birth-chart', '#page-birth-chart'], ['/booking', '#page-booking'], ['/#servicesSection', '#servicesSection']]) {
    await page.goto(route);
    await expect(page.locator('#entry-screen')).toHaveCount(0);
    await expect(page.locator(destination)).toBeVisible();
    await unlocked(page);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#entry-screen')).toHaveCount(0);
  await expect(page.locator('#heroSection .hero-h1')).toBeVisible();
  await unlocked(page);
  await page.mouse.move(640, 600);
  await page.mouse.wheel(0, 360);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(200);
});

test('Teva order language is explicit and the public site uses the professional business name', async ({ page }) => {
  await page.goto('/booking?service=teva-physical');
  await expect(page.locator('#teva-language-field')).toBeVisible();
  await page.locator('#booking-teva-language').selectOption('hi');
  await expect(page.locator('#booking-teva-language')).toHaveValue('hi');
  await page.locator('#booking-service').selectOption('kundali');
  await expect(page.locator('#teva-language-field')).toBeHidden();
  await page.locator('#booking-service').selectOption('teva-digital');
  await expect(page.locator('#booking-teva-language')).toHaveValue('hi');
  const icon = await page.request.get('/favicon.svg');
  expect(await icon.text()).toContain('SA');
  for (const route of ['/', '/services', '/about', '/contact', '/faq', '/terms']) {
    await page.goto(route);
    await expect(page.locator('body')).not.toContainText(/\b(?:pandit|pundit)\b/i);
  }
  await page.goto('/');
  await expect(page.locator('#storiesSection .review-card')).toHaveCount(8);
  expect(await page.locator('#storiesSection a[href*="google.com/maps/contrib/"]').evaluateAll(links => new Set(links.map(link => link.href)).size)).toBe(8);
  expect(await page.locator('#statsSection .stat-num').evaluateAll(elements => new Set(elements.map(el => getComputedStyle(el).fontFamily)).size)).toBe(1);
});

test('homepage service calls to action keep the intended service instead of resetting to Kundali', async ({ page }) => {
  await page.goto('/');
  await page.locator('#servicesSection a.svc-card[href*="type=teva"]').click();
  await expect(page).toHaveURL('/services?type=teva');
  await expect(page.locator('#all-services .service-card')).toHaveCount(2);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('.story-panel').nth(1).locator('.sp-cta').click();
  await expect(page).toHaveURL('/booking?service=marriage');
  await expect(page.locator('#booking-service')).toHaveValue('marriage');
});
