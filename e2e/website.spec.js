import { test, expect } from '@playwright/test';

const checkoutStub = `window.Razorpay = class {
  constructor(options) { this.options = options; }
  on() {}
  async open() {
    const options = this.options;
    const id = options.order_id.replace('order_', 'pay_');
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode('browser-test-only-secret'), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    const bytes = await crypto.subtle.sign('HMAC', key, enc.encode(options.order_id+'|'+id));
    const signature = Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2,'0')).join('');
    await options.handler({razorpay_order_id:options.order_id,razorpay_payment_id:id,razorpay_signature:signature});
    options.modal.ondismiss();
  }
};`;

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => {
    if (route.request().url() === 'https://checkout.razorpay.com/v1/checkout.js') {
      return route.fulfill({ contentType: 'application/javascript', body: checkoutStub });
    }
    return route.abort();
  });
});

test('desktop and mobile navigation, direct URLs, and browser Back work without script errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText("don't lie.");
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(244, 239, 230)');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.locator('#main-nav').getByRole('link', { name: 'Services', exact: true }).click();
  await expect(page).toHaveURL('/#servicesSection');
  await expect(page.locator('#servicesSection')).toBeInViewport();
  await page.goto('/services');
  await expect(page.locator('#all-services .service-card')).toHaveCount(5);
  await page.goBack();
  await expect(page).toHaveURL('/#servicesSection');
  for (const route of ['/services', '/services/kundali', '/about', '/faq', '/privacy', '/terms']) {
    const response = await page.goto(route);
    expect(response.status()).toBe(200);
    await expect(page.locator('main .page:visible')).toHaveCount(1);
  }
  expect(errors).toEqual([]);
  await page.goto('/');
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
});

test('birth chart stays local and hostile names render as plain text', async ({ page }) => {
  const numericalRequests = [];
  page.on('request', request => {
    if (/\/(chart-engine|astronomy-engine)\.js$/.test(request.url())) numericalRequests.push(request.url());
  });
  await page.goto('/birth-chart');
  const writes = [];
  page.on('request', request => { if (request.method() === 'POST') writes.push(request.url()); });
  const hostile = '<img src=x onerror="window.chartInjected=true">';
  await page.locator('#chart-name').fill(hostile);
  await page.locator('#chart-city').selectOption('jalandhar');
  expect(numericalRequests).toEqual([]);
  await page.locator('#chart-date').fill('1990-01-01');
  await page.locator('#chart-time').fill('10:20');
  await page.locator('#chart-submit').click();
  await expect(page.locator('#chart-result')).toBeVisible();
  await expect(page.locator('#chart-result h2')).toContainText(hostile);
  await expect(page.locator('#chart-result svg')).toHaveCount(2);
  await expect(page.locator('#chart-result table').first().locator('tbody tr')).toHaveCount(9);
  expect(numericalRequests.some(url => url.endsWith('/vendor/astronomy-engine.js'))).toBeTruthy();
  expect(await page.evaluate(() => window.chartInjected)).toBeUndefined();
  expect(writes).toEqual([]);
  await page.screenshot({ path: 'test-results/birth-chart.png', fullPage: true });
});

test('browser checkout confirms through the actual server and an admin can read the stored booking', async ({ page }) => {
  await page.goto('/booking?service=teva-digital');
  await expect(page.locator('#booking-service')).toHaveValue('teva-digital');
  await page.locator('#booking-teva-language').selectOption('hi');
  await page.locator('#booking-name').fill('Browser Test Customer');
  await page.locator('#booking-phone').fill('+919876543210');
  await page.locator('#booking-birth-date').fill('1990-01-01');
  await page.locator('#booking-birth-time').fill('10:20');
  await page.locator('#booking-birth-place').fill('Jalandhar');
  await page.locator('#booking-consent').check();
  await expect(page.locator('#booking-submit')).toBeEnabled();
  await page.locator('#booking-submit').click();
  await expect(page.locator('#booking-result-title')).toHaveText('Booking confirmed');
  await expect(page.locator('#booking-result-message')).toContainText('test');
  const reference = await page.locator('#booking-reference').innerText();
  await page.reload();
  await page.locator('#check-booking').click();
  await expect(page.locator('#booking-reference')).toHaveText(reference);
  await expect(page.locator('#booking-result-title')).toHaveText('Booking confirmed');
  await page.goto('/admin');
  await expect(page.locator('#admin-login')).toBeVisible();
  await page.locator('#admin-password').fill('browser test administrator passphrase');
  await page.locator('#admin-login button').click();
  await expect(page.locator('#admin-dashboard')).toBeVisible();
  await expect(page.locator('#admin-bookings')).toContainText(reference);
  await expect(page.locator('#admin-bookings')).toContainText('Browser Test Customer');
  await expect(page.locator('#admin-bookings')).toContainText('हिन्दी');
  await page.locator('#admin-logout').click();
  await expect(page.locator('#admin-login')).toBeVisible();
});

test('contact message reaches the protected inbox without executing submitted HTML', async ({ page }) => {
  await page.goto('/contact');
  await page.locator('#contact-name').fill('Test Enquiry');
  await page.locator('#contact-details').fill('test@example.com');
  const message = '<img src=x onerror="window.inboxInjected=true"> A question about a consultation.';
  await page.locator('#contact-message').fill(message);
  await page.locator('#contact-form input[type=checkbox]').check();
  await page.locator('#contact-submit').click();
  await expect(page.locator('#contact-status')).toContainText('received');
  await page.goto('/admin');
  await page.locator('#admin-password').fill('browser test administrator passphrase');
  await page.locator('#admin-login button').click();
  await expect(page.locator('#admin-contacts')).toContainText(message);
  expect(await page.evaluate(() => window.inboxInjected)).toBeUndefined();
});

test('unconfigured payments cannot open checkout', async ({ page }) => {
  await page.route('**/api/config', async route => {
    const response = await route.fetch();
    const config = await response.json();
    await route.fulfill({ json: { ...config, paymentsEnabled: false, paymentMode: null } });
  });
  await page.goto('/booking');
  await expect(page.locator('#payment-availability')).toContainText('not currently available');
  await expect(page.locator('#booking-submit')).toBeDisabled();
});

test('service filters are shareable and service detail booking preserves the chosen service', async ({ page }) => {
  await page.goto('/services');
  await page.locator('[data-service-filter="consultations"]').click();
  await expect(page.locator('#all-services .service-card')).toHaveCount(3);
  await expect(page.locator('[data-service-filter="consultations"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL('/services?type=consultations');
  await page.locator('[data-service-filter="teva"]').click();
  await expect(page.locator('#all-services .service-card')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('#all-services .service-card')).toHaveCount(2);
  await page.locator('#all-services a[href="/services/teva-physical"]').click();
  await expect(page.locator('#service-detail h1')).toHaveText('Physical Teva');
  await expect(page.locator('.preparation-card')).toContainText('delivery address');
  await page.locator('#service-detail a[href="/booking?service=teva-physical"]').click();
  await expect(page.locator('#booking-service')).toHaveValue('teva-physical');
  await expect(page.locator('#address-field')).toBeVisible();
  await expect(page.locator('#appointment-fields')).toBeHidden();
});

test('FAQ search finds answers, supports shared searches, and explains empty results', async ({ page }) => {
  await page.goto('/faq');
  await page.locator('#faq-search').fill('refund');
  await expect(page.locator('#faq-list details:visible').first()).toContainText(/refund/i);
  await expect(page.locator('#faq-list details:visible').first()).toHaveAttribute('open', '');
  await page.reload();
  await expect(page.locator('#faq-search')).toHaveValue('refund');
  await expect(page.locator('#faq-empty')).toBeHidden();
  await page.locator('#faq-search').fill('no-result-for-this-question');
  await expect(page.locator('#faq-empty')).toBeVisible();
  await expect(page.locator('#faq-list details:visible')).toHaveCount(0);
  await page.locator('#faq-search').fill('');
  expect(await page.locator('#faq-list details:visible').count()).toBeGreaterThan(5);
});

test('small-screen public pages fit, Escape restores menu focus, and contact links use real channels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.locator('#main-nav a').first().focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded', 'false');
  for (const path of ['/services', '/services/marriage', '/about', '/contact', '/faq', '/birth-chart', '/booking']) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} should fit at 320px`).toBeTruthy();
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  }
  await page.goto('/contact');
  await expect(page.locator('#page-contact a[href="tel:+919465245577"]').first()).toBeVisible();
  await page.goto('/services/marriage');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /two birth charts/);
});
