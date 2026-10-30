import { test, expect } from '@playwright/test';

const authors = ['Ankur Yadav', 'Manu Verma', 'Ajay Verma', 'Shivangi J', 'Yogita Virdi', 'Vijay Kumar', 'Umesh Chadda', 'Jasleen Kaur'];
const isInTrack = async (page, index) => page.locator('#reviews-track').evaluate((track, cardIndex) => {
  const card = track.querySelectorAll('.review-card')[cardIndex];
  const bounds = track.getBoundingClientRect(), item = card.getBoundingClientRect();
  return item.left >= bounds.left - 2 && item.right <= bounds.right + 2;
}, index);

test('the review section restores the supplied full reviews and their real Google sources', async ({ page }) => {
  const external = [], errors = [];
  page.on('request', request => {
    if (!request.url().startsWith('http://localhost:4173/')) external.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
  await page.goto('/');
  const section = page.locator('#storiesSection');
  await expect(section.locator('.review-card')).toHaveCount(8);
  for (const author of authors) await expect(section.getByRole('link', { name: author, exact: true })).toHaveCount(1);
  await expect(section).toContainText('Everything was explained in a point-to-point and practical way.');
  await expect(section).toContainText('Benefactor of society.');
  await expect(section).toContainText('He really deserves praise.');
  const reviewLinks = await section.locator('a[href*="google.com/maps/contrib/"]').evaluateAll(links => [...new Set(links.map(link => new URL(link.href).pathname))]);
  expect(reviewLinks).toHaveLength(8);
  expect(reviewLinks.every(path => /^\/maps\/contrib\/\d+\/reviews$/.test(path))).toBeTruthy();
  const businessLinks = section.locator('a[href*="google.com/maps/place/Sahni"]');
  expect(await businessLinks.count()).toBeGreaterThan(0);
  await expect(section).not.toContainText(/live from Google|updates automatically/i);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('mobile review controls and keyboard navigation reach every original review without page overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const track = page.locator('#reviews-track');
  await track.scrollIntoViewIfNeeded();
  await expect.poll(() => isInTrack(page, 0)).toBeTruthy();
  await expect(page.locator('#reviews-prev')).toBeDisabled();
  await page.locator('#reviews-next').click();
  await expect.poll(() => isInTrack(page, 1)).toBeTruthy();
  for (let step = 0; step < 6; step++) {
    await page.locator('#reviews-next').click();
    await expect.poll(() => isInTrack(page, step + 2)).toBeTruthy();
  }
  await expect.poll(() => isInTrack(page, 7)).toBeTruthy();
  await expect(page.locator('#reviews-next')).toBeDisabled();
  await expect(page.locator('#reviews-status')).toContainText('8');
  await track.focus();
  await page.keyboard.press('Home');
  await expect.poll(() => isInTrack(page, 0)).toBeTruthy();
  await page.keyboard.press('End');
  await expect.poll(() => isInTrack(page, 7)).toBeTruthy();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => isInTrack(page, 6)).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('reviews stay still while clients read and have no automatic-movement control', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const track = page.locator('#reviews-track');
  await track.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.clock.runFor(25000);
  expect(await track.evaluate(element => element.scrollLeft)).toBe(0);
  await expect(page.locator('#reviews-autoplay')).toHaveCount(0);
  await expect(page.locator('#storiesSection')).not.toContainText(/pause|resume|automatic reviews/i);
  await expect(page.locator('#reviews-status')).toHaveAttribute('aria-live', 'polite');
});

test('mobile clients can swipe the review cards directly', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const track = page.locator('#reviews-track');
  await track.scrollIntoViewIfNeeded();
  const bounds = await track.boundingBox();
  const touch = await context.newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const y = Math.min(bounds.y + bounds.height / 2, 700);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 330, y }] });
  for (let step = 1; step <= 8; step++) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 330 - 32 * step, y }] });
    await page.waitForTimeout(20);
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => track.evaluate(element => element.scrollLeft)).toBeGreaterThan(100);
  await touch.detach();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('reduced motion keeps review movement manual and cards fit desktop and mobile layouts', async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height, visible] of [[1440, 1000, 3], [768, 900, 2], [390, 844, 1], [320, 700, 1]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const track = page.locator('#reviews-track');
    await track.scrollIntoViewIfNeeded();
    await expect(page.locator('#reviews-autoplay')).toHaveCount(0);
    await page.clock.runFor(12500);
    expect(await track.evaluate(element => element.scrollLeft)).toBe(0);
    for (let index = 0; index < visible; index++) expect(await isInTrack(page, index)).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});


test('review headings remain visible, separated and stable while cards move', async ({ page }) => {
  for (const [width, height] of [[1440, 1000], [768, 900], [390, 844], [320, 700]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#storiesSection').evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + scrollY - 100, behavior: 'instant' }));
    await page.mouse.move(0, 0);
    const snapshot = () => page.locator('#storiesSection').evaluate(section => {
      const heading = section.querySelector('#review-heading');
      const subtitle = section.querySelector('.reviews-intro');
      const headingRect = heading.getBoundingClientRect(), subtitleRect = subtitle.getBoundingClientRect();
      return {
        heading: { x: headingRect.x, y: headingRect.y, width: headingRect.width, height: headingRect.height },
        gap: subtitleRect.top - headingRect.bottom,
        opacity: getComputedStyle(heading).opacity,
        subtitleOpacity: getComputedStyle(subtitle).opacity,
        animations: [heading, subtitle].reduce((total, element) => total + element.getAnimations().filter(animation => animation.playState === 'running').length, 0),
      };
    });
    const before = await snapshot();
    expect(before.gap).toBeGreaterThanOrEqual(14);
    expect(before.opacity).toBe('1');
    expect(before.subtitleOpacity).toBe('1');
    expect(before.animations).toBe(0);
    await page.locator('#reviews-track').evaluate(element => element.focus({ preventScroll: true }));
    await page.keyboard.press('ArrowRight');
    // Native smooth scrolling runs on compositor time, independently of the JS clock.
    await expect.poll(() => page.locator('#reviews-track').evaluate(element => {
      const cards = element.querySelectorAll('.review-card');
      return Math.abs(element.scrollLeft - (cards[1].offsetLeft - cards[0].offsetLeft));
    })).toBeLessThan(1);
    const after = await snapshot();
    for (const key of ['x', 'y', 'width', 'height']) expect(after.heading[key]).toBeCloseTo(before.heading[key], 0);
    expect(after.gap).toBeGreaterThanOrEqual(14);
    expect(after.opacity).toBe('1');
    expect(after.subtitleOpacity).toBe('1');
    expect(after.animations).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});
