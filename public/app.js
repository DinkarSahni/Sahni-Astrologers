import { initChartView } from '/chart-view.js';
import { initializeMotion } from '/motion.js';
import { initializeVisit } from '/visit.js';

const $ = (selector, parent = document) => parent.querySelector(selector);
const standalonePreview = $('meta[name="site-mode"]')?.content === 'standalone-preview';
const routeLocation = () => standalonePreview
  ? new URL(location.hash.startsWith('#/') ? location.hash.slice(1) : '/', 'https://preview.invalid')
  : new URL(location.href);
const navigationHref = path => standalonePreview ? `#${path}` : path;
function writeRoute(url, { replace = false } = {}) {
  // srcdoc inherits its parent's base URL. Resolve against this document so a
  // restricted preview updates its own history instead of the viewer's URL.
  const target = standalonePreview
    ? new URL(`#${url.pathname}${url.search}${url.hash}`, location.href).href
    : url.pathname + url.search + url.hash;
  history[replace ? 'replaceState' : 'pushState'](null, '', target);
}
const money = (amount, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount / 100);
const descriptions = {
  kundali: { intro: 'A personal reading of your birth chart, with time to discuss the questions that brought you here.', includes: ['Lagna, planetary placements and traditional chart interpretation', 'Discussion of current dashas and your areas of interest', 'Personal guidance and an opportunity to ask questions'], duration: 'Allow around 90 minutes. Confirm the consultation format with us.' },
  marriage: { intro: 'A thoughtful look at two birth charts through the tradition of Kundali matching.', includes: ['Discussion of compatibility and traditional Guna matching', 'Review of relevant chart factors and questions', 'Personal consultation about the interpretation'], duration: 'Allow around 90 minutes. We will arrange how to receive both sets of birth details with permission.' },
  career: { intro: 'A consultation about career questions through your birth chart and traditional astrological interpretation.', includes: ['Discussion of career-related chart factors', 'Current planetary periods in the traditional framework', 'Time to explore your questions and next steps'], duration: 'Allow around 75 minutes. This service is not investment or financial advice.' },
  'teva-digital': { intro: 'A digital record of your birth chart, prepared for you by the practice.', includes: ['Individual chart preparation', 'Digital Teva supplied through an agreed contact method', 'Normally prepared within 24 hours after complete details are received'], duration: 'No appointment slot required. Please contact us if you have an urgent deadline.' },
  'teva-physical': { intro: 'A printed Teva, prepared and delivered to your address in India.', includes: ['Individual chart preparation', 'Printed Teva with delivery in India', 'Preparation and delivery timing confirmed with you'], duration: 'No appointment slot required. Please provide a complete Indian delivery address.' },
};
const fallbackServices = [
  { id: 'kundali', name: 'Kundali Reading', amount: 110000, currency: 'INR', requiresSlot: true },
  { id: 'marriage', name: 'Marriage Matching', amount: 150000, currency: 'INR', requiresSlot: true },
  { id: 'career', name: 'Career & Finance', amount: 110000, currency: 'INR', requiresSlot: true },
  { id: 'teva-digital', name: 'Digital Teva', amount: 70000, currency: 'INR', requiresSlot: false },
  { id: 'teva-physical', name: 'Physical Teva', amount: 90000, currency: 'INR', requiresSlot: false, requiresAddress: true },
];
let config = { services: fallbackServices, paymentsEnabled: false };
let configLoaded = false;
let requestAttempt = null;
let availabilitySequence = 0;
let currentBooking = null;
let checkoutScriptPromise = null;
let checkoutActive = false;
let lastBookingStatus = null;
let selectedServiceFilter = 'all';

const servicePreparation = {
  kundali: ['Your birth date, local birth time, and birth city', 'A few questions you would like to discuss'],
  marriage: ['Both people’s birth dates, times, and cities', 'Permission from the other person to share their details'],
  career: ['Your birth date, local birth time, and birth city', 'The career or business questions you would like to explore'],
  'teva-digital': ['Your birth date, local birth time, and birth city', 'A contact method for receiving your digital Teva'],
  'teva-physical': ['Your birth date, local birth time, and birth city', 'A complete delivery address in India'],
};

function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined && text !== null) el.textContent = String(text);
  if (className) el.className = className;
  return el;
}
function internalLink(text, path, className) {
  const a = node('a', text, className);
  a.href = navigationHref(path);
  a.dataset.nav = '';
  return a;
}
async function api(path, options = {}) {
  if (standalonePreview) throw new Error('This local preview cannot send bookings or payments. Please call or message the practice.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(path, { credentials: 'same-origin', ...options, signal: controller.signal, headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || 'The request could not be completed. Please try again.');
      error.code = result.code;
      error.status = response.status;
      throw error;
    }
    return result;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The request is taking too long. Please check the booking status before paying again.');
    throw error;
  } finally { clearTimeout(timeout); }
}

const pageNames = { home: 'Vedic Astrology Since 1952 | Jalandhar', services: 'Our Services', service: 'Our Services', about: 'Our Family Story', booking: 'Book a Reading', 'birth-chart': 'Free Birth Chart', contact: 'Contact & Directions', faq: 'Frequently Asked Questions', privacy: 'Privacy Policy', terms: 'Booking Terms & Refunds', disclaimer: 'Astrology & Chart Disclaimer', 'not-found': 'Page Not Found' };
const pageDescriptions = {
  home: 'A family tradition of Vedic astrology since 1952 in Jalandhar. Explore personal consultations, Kundali matching, and Teva preparation.',
  services: 'Compare Kundali readings, marriage matching, career consultations, and digital or printed Tevas. See prices and what to prepare.',
  about: 'Discover the family tradition behind Sahni Astrologers, a Vedic astrology practice established in Jalandhar in 1952.',
  booking: 'Choose your service and appointment, share your birth details, and check your booking with Sahni Astrologers in Jalandhar.',
  'birth-chart': 'Calculate a private sidereal birth chart on your device. Explore planetary placements, Navamsa, nakshatras, and Vimshottari periods.',
  contact: 'Call Sahni Astrologers, find visiting hours and directions to Jalandhar, or send a consultation enquiry.',
  faq: 'Find answers about birth details, consultations, Teva delivery, appointments, payments, and the free birth-chart calculator.',
  privacy: 'How Sahni Astrologers handles consultation details, enquiries, payments, and private birth-chart calculations.',
  terms: 'Read the booking, cancellation, refund, and Teva delivery terms for Sahni Astrologers.',
  disclaimer: 'Understand the scope of traditional astrology, the free Kundali calculator, client reviews, and professional guidance.',
};
function updateMetadata(description) {
  $('meta[name="description"]').content = description;
  $('meta[property="og:title"]').content = document.title;
  $('meta[property="og:description"]').content = description;
  const origin = $('meta[name="site-origin"]')?.content;
  const canonical = $('link[rel="canonical"]');
  if (origin && canonical && !standalonePreview) {
    const path = routeLocation().pathname.replace(/\/$/, '') || '/';
    const url = new URL(path, origin).href;
    canonical.href = url;
    $('meta[property="og:url"]').content = url;
    $('meta[name="robots"]').content = path === '/booking' || !$('#page-not-found').hidden ? 'noindex, nofollow' : 'index, follow';
  }
}
function closeNavigation({ restoreFocus = false } = {}) {
  const wasOpen = $('#main-nav').classList.contains('open');
  $('#main-nav').classList.remove('open');
  $('#menu-toggle').setAttribute('aria-expanded', 'false');
  $('#menu-toggle').setAttribute('aria-label', 'Open navigation');
  if (restoreFocus && wasOpen) $('#menu-toggle').focus();
}
function route({ focus = false } = {}) {
  const current = routeLocation();
  const path = current.pathname.replace(/\/$/, '') || '/';
  let page = path === '/' ? 'home' : path.slice(1);
  const service = path.match(/^\/services\/([a-z-]+)$/);
  if (service) page = 'service';
  if (!Object.hasOwn(pageNames, page)) page = 'not-found';
  if (page === 'service' && !config.services.some((item) => item.id === service[1])) page = 'not-found';
  document.querySelectorAll('[data-page]').forEach((el) => { el.hidden = el.dataset.page !== page; });
  document.querySelectorAll('#main-nav a').forEach((a) => {
    const navPath = standalonePreview ? a.getAttribute('href').slice(1).split(/[?#]/)[0] : a.pathname;
    if (navPath === path || (navPath === '/services' && page === 'service')) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = `Sahni Astrologers — ${pageNames[page]}`;
  updateMetadata(pageDescriptions[page] || pageDescriptions.home);
  closeNavigation();
  if (page === 'service') renderService(service[1]);
  if (page === 'services') {
    const filter = current.searchParams.get('type');
    selectedServiceFilter = ['consultations', 'teva'].includes(filter) ? filter : 'all';
    filterServices();
  }
  if (page === 'faq' && $('#faq-search')) {
    $('#faq-search').value = current.searchParams.get('q')?.slice(0, 100) || '';
    filterFaq();
  }
  if (page === 'booking') {
    const selected = current.searchParams.get('service');
    if (selected && config.services.some((item) => item.id === selected)) { $('#booking-service').value = selected; updateService(); }
    if (currentBooking) $('#pending-booking').hidden = false;
  }
  if (focus) {
    window.scrollTo(0, 0);
    $('#main').focus({ preventScroll: true });
    const anchor = current.hash && document.getElementById(current.hash.slice(1));
    if (anchor && !anchor.closest('[hidden]')) anchor.scrollIntoView({ block: 'start' });
  }
  window.dispatchEvent(new CustomEvent('sahni:route', { detail: { page, path } }));
}
document.addEventListener('click', (event) => {
  const a = event.target.closest('a[data-nav]');
  if (!a || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const href = a.getAttribute('href');
  if (standalonePreview ? !href?.startsWith('#/') || href.startsWith('#//') : a.origin !== location.origin) return;
  event.preventDefault();
  const target = standalonePreview
    ? new URL(href.slice(1), 'https://preview.invalid')
    : new URL(a.href);
  writeRoute(target);
  route({ focus: true });
});
window.addEventListener('popstate', () => route({ focus: true }));
if (standalonePreview) window.addEventListener('hashchange', () => route({ focus: true }));
$('#menu-toggle').addEventListener('click', () => {
  const open = $('#main-nav').classList.toggle('open');
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
  $('#menu-toggle').setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeNavigation({ restoreFocus: true });
});
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeNavigation();
});

function renderCards(target, services) {
  target.replaceChildren(...services.map((service, index) => {
    const a = internalLink('', `/services/${service.id}`, 'service-card');
    const top = node('div', undefined, 'service-top');
    top.append(node('span', `0${config.services.findIndex(item => item.id === service.id) + 1}`, 'service-index'), node('span', service.requiresSlot ? 'Personal consultation' : 'Chart preparation', 'service-kind'));
    a.append(top, node('h3', service.name), node('p', descriptions[service.id]?.intro || 'Contact us for details.'), node('span', service.requiresSlot ? `${service.id === 'career' ? '75' : '90'} minutes · By appointment` : service.requiresAddress ? 'Printed · Delivery within India' : 'Digital · No appointment needed', 'service-duration'));
    const bottom = node('div', undefined, 'card-bottom');
    bottom.append(node('span', money(service.amount, service.currency)), node('span', 'Explore →'));
    a.append(bottom);
    return a;
  }));
}
function filterServices() {
  const services = config.services.filter(service => selectedServiceFilter === 'all' || (selectedServiceFilter === 'consultations' ? service.requiresSlot : !service.requiresSlot));
  renderCards($('#all-services'), services);
  document.querySelectorAll('[data-service-filter]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.serviceFilter === selectedServiceFilter));
  });
  if ($('#service-count')) $('#service-count').textContent = `${services.length} ${services.length === 1 ? 'service' : 'services'} · Prices in Indian rupees`;
}
$('#service-filters')?.addEventListener('click', event => {
  const button = event.target.closest('[data-service-filter]');
  if (!button) return;
  selectedServiceFilter = button.dataset.serviceFilter;
  const url = routeLocation();
  if (selectedServiceFilter === 'all') url.searchParams.delete('type');
  else url.searchParams.set('type', selectedServiceFilter);
  writeRoute(url, { replace: true });
  filterServices();
});
function filterFaq() {
  const query = $('#faq-search').value.trim().toLocaleLowerCase();
  const questions = [...document.querySelectorAll('#faq-list details')];
  let count = 0;
  for (const question of questions) {
    const matches = question.textContent.toLocaleLowerCase().includes(query);
    question.hidden = !matches;
    question.open = matches && Boolean(query);
    if (matches) count++;
  }
  $('#faq-empty').hidden = count > 0;
  $('#faq-results-count').textContent = query ? `${count} ${count === 1 ? 'answer' : 'answers'} found` : `${count} questions answered`;
}
$('#faq-search')?.addEventListener('input', () => {
  const url = routeLocation();
  const query = $('#faq-search').value.trim();
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  writeRoute(url, { replace: true });
  filterFaq();
});
function renderService(id) {
  const service = config.services.find((item) => item.id === id);
  const detail = descriptions[id];
  const target = $('#service-detail');
  const layout = node('div', undefined, 'service-detail-layout');
  const copy = node('div', undefined, 'service-detail-copy');
  copy.append(node('p', service.requiresSlot ? 'A personal consultation' : 'Your chart, preserved', 'eyebrow'), node('h1', service.name), node('p', detail.intro, 'lead'));
  const includes = node('div', undefined, 'service-includes');
  includes.append(node('h2', 'What to expect'));
  const list = node('ul');
  detail.includes.forEach((text) => list.append(node('li', text)));
  includes.append(list);
  const preparation = node('section', undefined, 'preparation-card');
  preparation.append(node('h2', 'A little preparation'));
  const checklist = node('ul');
  servicePreparation[id].forEach(text => checklist.append(node('li', text)));
  preparation.append(checklist, node('p', 'If your birth time is uncertain, speak to us before paying. We can explain what that means for your reading.', 'fineprint'));
  copy.append(includes, preparation);
  const panel = node('aside', undefined, 'service-price-panel');
  panel.setAttribute('aria-label', 'Service price and booking');
  panel.append(node('p', service.requiresSlot ? 'Make time for your questions' : 'Prepared for you', 'eyebrow'), node('p', money(service.amount, service.currency), 'price'), node('p', detail.duration, 'muted'), internalLink(service.requiresSlot ? 'Choose an appointment →' : 'Request your Teva →', `/booking?service=${service.id}`, 'button'), internalLink('Have a question first?', '/contact', 'text-link'), node('p', 'Clear prices. Personal attention.', 'fineprint'));
  layout.append(copy, panel);
  target.replaceChildren(layout);
  document.title = `${service.name} — Sahni Astrologers`;
  updateMetadata(detail.intro);
}
function updateService() {
  const selected = config.services.find((service) => service.id === $('#booking-service').value);
  if (!selected) return;
  $('#booking-description').textContent = descriptions[selected.id]?.duration || '';
  $('#summary-service').textContent = selected.name;
  $('#summary-price').textContent = money(selected.amount, selected.currency);
  $('#appointment-fields').hidden = !selected.requiresSlot;
  $('#booking-date').required = selected.requiresSlot;
  $('#booking-time').required = selected.requiresSlot;
  $('#address-field').hidden = !selected.requiresAddress;
  $('#booking-address').required = !!selected.requiresAddress;
  if ($('#teva-language-field')) $('#teva-language-field').hidden = !selected.id.startsWith('teva-');
  $('#availability-message').textContent = '';
  if (selected.requiresSlot && $('#booking-date').value) loadAvailability();
}
function populateServices() {
  renderCards($('#home-services'), config.services);
  filterServices();
  const old = $('#booking-service').value;
  $('#booking-service').replaceChildren(...config.services.map((service) => {
    const option = node('option', `${service.name} — ${money(service.amount, service.currency)}`);
    option.value = service.id;
    return option;
  }));
  if (config.services.some((item) => item.id === old)) $('#booking-service').value = old;
  updateService();
  $('#booking-submit').disabled = !configLoaded || !config.paymentsEnabled;
  if (!config.paymentsEnabled) $('#booking-submit').textContent = standalonePreview ? 'Preview — online checkout unavailable' : 'Online checkout is not active yet';
  $('#payment-availability').textContent = standalonePreview
    ? 'Local website preview. To arrange a reading, call +91 94652 45577 or use WhatsApp. Online payments require the live, server-connected website.'
    : configLoaded && config.paymentsEnabled
    ? (config.paymentMode === 'test' ? 'Test checkout only. No real service booking is made in Razorpay test mode.' : 'Online booking is available. Your selected time is held briefly during checkout.')
    : 'Online payments are not currently available. Please call or message us to arrange your reading. Do not send payment details through this form.';
}
$('#booking-service').addEventListener('change', updateService);
$('#booking-date').addEventListener('change', loadAvailability);
async function loadAvailability() {
  const sequence = ++availabilitySequence;
  const date = $('#booking-date').value;
  const select = $('#booking-time');
  select.replaceChildren(node('option', 'Checking availability…'));
  select.disabled = true;
  $('#availability-message').textContent = '';
  if (standalonePreview) {
    select.replaceChildren(node('option', 'Please call to arrange an appointment'));
    $('#availability-message').textContent = 'Live appointment availability is available on the server-connected website. No appointment is reserved in this preview.';
    return;
  }
  if (!date) { select.replaceChildren(node('option', 'Choose a date first')); return; }
  try {
    const result = await api(`/api/availability?date=${encodeURIComponent(date)}`);
    if (sequence !== availabilitySequence) return;
    const slots = result.slots || [];
    const first = node('option', slots.length ? 'Choose a start time' : 'No times available on this date');
    first.value = '';
    select.replaceChildren(first, ...slots.map((time) => { const option = node('option', `${time} IST`); option.value = time; return option; }));
    select.disabled = !slots.length;
    if (!slots.length) $('#availability-message').textContent = 'Please choose another date, or contact us for help.';
  } catch (error) {
    if (sequence !== availabilitySequence) return;
    select.replaceChildren(node('option', 'Availability unavailable'));
    $('#availability-message').textContent = error.message;
  }
}

function saveBooking(value) {
  currentBooking = value;
  try { sessionStorage.setItem('sahni.booking', JSON.stringify(value)); } catch { /* status still works while this page remains open */ }
  $('#pending-booking').hidden = false;
}
try {
  const saved = JSON.parse(sessionStorage.getItem('sahni.booking') || 'null');
  if (saved && /^[a-zA-Z0-9_-]{8,100}$/.test(saved.bookingId) && /^[a-f0-9]{64}$/.test(saved.accessToken)) currentBooking = saved;
} catch { /* private browsing or no saved booking */ }
function randomToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) => value.toString(16).padStart(2, '0')).join(''); }
function showBookingStatus(result) {
  const target = $('#booking-result');
  const status = result.status;
  lastBookingStatus = result;
  const messages = {
    confirmed: ['Booking confirmed', config.paymentMode === 'test' ? 'The test payment was verified. This is a test booking, not a live appointment. No live payment was collected.' : 'Your payment has been verified and your booking is confirmed. Please keep this reference and contact us if you need to discuss the arrangements.'],
    payment_pending: ['Payment is being checked', 'We have not yet verified a completed payment. If your account was debited, do not pay again. Check the status shortly or contact us with this reference.'],
    pending: ['Payment is being checked', 'Your booking is not confirmed yet. If your account was debited, do not pay again. Check the status shortly.'],
    awaiting_payment: ['Payment not confirmed', 'Your booking is not confirmed yet. If you paid, check the status again before trying another payment.'],
    manual_review: ['We need to review this booking', 'Your payment or appointment needs a manual check. Please contact us with this reference. Do not make another payment.'],
    expired: ['The checkout hold has expired', 'The appointment hold has expired. If you paid, contact us with this reference before making another payment.'],
    refunded: ['Payment refunded', 'The payment has been marked as refunded. Please contact us if you need help with the next step.'],
    failed: ['Payment not completed', 'We have not confirmed this payment. If your account was debited, please check with us before trying again.'],
  };
  const [title, message] = messages[status] || messages.payment_pending;
  $('#booking-result-title').textContent = title;
  $('#booking-result-message').textContent = message;
  $('#booking-reference').textContent = result.bookingId || currentBooking?.bookingId || '';
  $('#resume-booking').hidden = !(status === 'awaiting_payment' && result.orderId && result.keyId && new Date(result.holdExpiresAt).getTime() > Date.now());
  $('#new-booking').hidden = !['confirmed', 'refunded', 'expired', 'failed'].includes(status);
  target.hidden = false;
  target.focus();
  target.scrollIntoView({ behavior: 'auto', block: 'center' });
}
async function checkBooking(booking = currentBooking) {
  if (!booking) return;
  const buttons = [$('#check-booking'), $('#refresh-booking')];
  buttons.forEach((button) => { button.disabled = true; });
  try { saveBooking(booking); showBookingStatus(await api(`/api/bookings/${encodeURIComponent(booking.bookingId)}`, { headers: { Authorization: `Bearer ${booking.accessToken}` } })); }
  catch (error) { $('#booking-error').textContent = error.message; }
  finally { buttons.forEach((button) => { button.disabled = false; }); }
}
$('#check-booking').addEventListener('click', () => checkBooking());
$('#refresh-booking').addEventListener('click', () => checkBooking());
$('#new-booking').addEventListener('click', () => {
  if (!lastBookingStatus || !['confirmed', 'refunded', 'expired', 'failed'].includes(lastBookingStatus.status)) return;
  if (['expired', 'failed'].includes(lastBookingStatus.status) && !window.confirm('Only start again if no payment was debited, or the business has checked the payment with you. If money was debited, contact us before paying again. Continue?')) return;
  currentBooking = null; lastBookingStatus = null; requestAttempt = null;
  try { sessionStorage.removeItem('sahni.booking'); } catch { /* unavailable storage */ }
  $('#pending-booking').hidden = true; $('#booking-result').hidden = true;
  $('#booking-form').scrollIntoView({ behavior: 'auto', block: 'start' });
  $('#booking-service').focus();
});
$('#resume-booking').addEventListener('click', async () => {
  if (!currentBooking || checkoutActive) return;
  const booking = { ...currentBooking };
  $('#resume-booking').disabled = true;
  try {
    const latest = await api(`/api/bookings/${encodeURIComponent(booking.bookingId)}`, { headers: { Authorization: `Bearer ${booking.accessToken}` } });
    showBookingStatus(latest);
    if (latest.status !== 'awaiting_payment' || new Date(latest.holdExpiresAt).getTime() <= Date.now()) return;
    await loadCheckout();
    openCheckout(latest, booking);
  } catch (error) { $('#booking-error').textContent = error.message; }
  finally { $('#resume-booking').disabled = false; }
});
function loadCheckout() {
  if (typeof window.Razorpay === 'function') return Promise.resolve();
  if (checkoutScriptPromise) return checkoutScriptPromise;
  checkoutScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    const timer = setTimeout(() => { script.remove(); checkoutScriptPromise = null; reject(new Error('The payment window could not load. Please try again or contact us.')); }, 15000);
    script.addEventListener('load', () => { clearTimeout(timer); if (typeof window.Razorpay === 'function') resolve(); else { checkoutScriptPromise = null; reject(new Error('Payment checkout is unavailable.')); } });
    script.addEventListener('error', () => { clearTimeout(timer); script.remove(); checkoutScriptPromise = null; reject(new Error('The payment window could not load. Please check your connection.')); });
    document.head.append(script);
  });
  return checkoutScriptPromise;
}
function unlockCheckout() {
  checkoutActive = false;
  $('#booking-submit').disabled = !configLoaded || !config.paymentsEnabled;
  $('#booking-submit').textContent = 'Continue to secure payment →';
}
function openCheckout(result, booking, prefill = {}) {
  if (!result.orderId || !result.keyId || !Number.isSafeInteger(result.amount) || result.currency !== 'INR') throw new Error('Checkout could not be prepared. Please contact us with your booking reference.');
  const checkout = new window.Razorpay({
    key: result.keyId, order_id: result.orderId, amount: result.amount, currency: result.currency,
    name: 'Sahni Astrologers', description: result.serviceName, theme: { color: '#886818' }, prefill,
    handler: async (response) => {
      $('#booking-error').textContent = '';
      try {
        const status = await api(`/api/bookings/${encodeURIComponent(booking.bookingId)}/verify`, { method: 'POST', headers: { Authorization: `Bearer ${booking.accessToken}` }, body: JSON.stringify({ razorpay_payment_id: response.razorpay_payment_id, razorpay_order_id: response.razorpay_order_id, razorpay_signature: response.razorpay_signature }) });
        saveBooking(booking); showBookingStatus(status);
      } catch (error) {
        saveBooking(booking);
        $('#booking-error').textContent = `${error.message} Your payment is not yet confirmed here. Do not pay again; check the status or contact us with reference ${booking.bookingId}.`;
        showBookingStatus({ status: 'payment_pending' });
      } finally { unlockCheckout(); }
    },
    modal: { ondismiss: () => { unlockCheckout(); checkBooking(booking); } },
  });
  checkout.on('payment.failed', () => { $('#booking-error').textContent = 'Checkout reported a payment problem. If your account was debited, check the booking status before paying again.'; });
  checkoutActive = true;
  $('#booking-submit').disabled = true;
  try { checkout.open(); } catch (error) { unlockCheckout(); throw error; }
}
// These controls use JavaScript actions; they do not navigate or submit a form
// to another page. Explicit clicks also work in viewers that disallow forms.
function bindFormAction(form, button, action) {
  const activate = event => {
    event.preventDefault();
    if (!button.disabled) void action(event);
  };
  form.addEventListener('submit', activate);
  button.addEventListener('click', activate);
  form.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing && event.target.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"])')) activate(event);
  });
}
const bookingForm = $('#booking-form');
bindFormAction(bookingForm, $('#booking-submit'), async (event) => {
  event.preventDefault();
  $('#booking-error').textContent = '';
  if (!configLoaded || !config.paymentsEnabled) { $('#booking-error').textContent = 'Online payment is unavailable. Please contact us to arrange your reading.'; return; }
  if (checkoutActive) return;
  if (currentBooking) { await checkBooking(); $('#booking-error').textContent = 'Please review your existing booking below. Resume its checkout, or use “Start another booking” once the previous payment is resolved.'; return; }
  if (!bookingForm.reportValidity()) return;
  const selected = config.services.find((item) => item.id === $('#booking-service').value);
  const data = new FormData(bookingForm);
  const payload = {
    serviceId: selected.id, name: data.get('name').trim(), phone: data.get('phone').trim(), email: data.get('email').trim() || undefined,
    birthDate: data.get('birthDate'), birthTime: data.get('birthTime'), birthPlace: data.get('birthPlace').trim(),
    address: selected.requiresAddress ? data.get('address').trim() : undefined, notes: data.get('notes').trim() || undefined,
    tevaLanguage: selected.id.startsWith('teva-') ? data.get('tevaLanguage') || 'en' : undefined,
    date: selected.requiresSlot ? data.get('date') : undefined, time: selected.requiresSlot ? data.get('time') : undefined, consent: true,
  };
  const fingerprint = JSON.stringify(payload);
  if (!requestAttempt || requestAttempt.fingerprint !== fingerprint) requestAttempt = { fingerprint, id: crypto.randomUUID(), token: randomToken() };
  $('#booking-submit').disabled = true;
  $('#booking-submit').textContent = 'Preparing secure checkout…';
  try {
    await loadCheckout();
    const result = await api('/api/bookings', { method: 'POST', headers: { 'Idempotency-Key': requestAttempt.id }, body: JSON.stringify({ ...payload, accessToken: requestAttempt.token }) });
    const booking = { bookingId: result.bookingId, accessToken: requestAttempt.token };
    saveBooking(booking);
    if (result.status === 'confirmed' || result.status === 'manual_review') { showBookingStatus(result); return; }
    openCheckout(result, booking, { name: payload.name, contact: payload.phone, email: payload.email || '' });
  } catch (error) {
    $('#booking-error').textContent = error.message;
    if (['HOLD_EXPIRED', 'SLOT_UNAVAILABLE'].includes(error.code)) { requestAttempt = null; loadAvailability(); }
  }
  finally { if (!checkoutActive) { $('#booking-submit').disabled = false; $('#booking-submit').textContent = 'Continue to secure payment →'; } }
});

const contactForm = $('#contact-form');
bindFormAction(contactForm, $('#contact-submit'), async (event) => {
  event.preventDefault();
  const form = contactForm;
  if (!form.reportValidity()) return;
  const button = $('#contact-submit');
  const data = new FormData(form);
  if (standalonePreview) {
    const text = `Hello Sahni Astrologers,\n\nName: ${data.get('name').trim()}\nContact: ${data.get('contact').trim()}\nTopic: ${data.get('topic')}\n\n${data.get('message').trim()}`;
    const link = node('a', 'Open the WhatsApp draft →', 'text-link');
    link.href = `https://wa.me/919465245577?text=${encodeURIComponent(text)}`;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    $('#contact-status').replaceChildren(node('span', 'Nothing has been sent. Open this draft and tap Send in WhatsApp to deliver your enquiry. '), link);
    return;
  }
  button.disabled = true;
  $('#contact-status').className = '';
  $('#contact-status').textContent = 'Sending your message…';
  try {
    await api('/api/contact', { method: 'POST', body: JSON.stringify({ name: data.get('name').trim(), contact: data.get('contact').trim(), topic: data.get('topic'), message: data.get('message').trim(), consent: true }) });
    $('#contact-status').textContent = 'Your message has been received for the business to review. For an urgent enquiry, please call or open WhatsApp and tap Send.';
    form.reset();
  } catch (error) { $('#contact-status').className = 'error'; $('#contact-status').textContent = `${error.message} You can also call or message us on WhatsApp.`; }
  finally { button.disabled = false; }
});

initChartView({ navigationHref });

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
$('#booking-date').min = today;
$('#booking-birth-date').max = today;
$('#chart-date').max = today;
$('#chart-date').min = '1900-01-01';
if (standalonePreview) {
  document.querySelectorAll('a[data-nav]').forEach(a => {
    const path = a.getAttribute('href');
    if (path?.startsWith('/')) a.setAttribute('href', navigationHref(path));
  });
  configLoaded = true;
  const submit = $('#contact-submit');
  if (submit) submit.textContent = 'Prepare a WhatsApp enquiry →';
}
initializeMotion();
initializeVisit();
populateServices();
route();
if (!standalonePreview) api('/api/config').then((result) => {
  if (!Array.isArray(result.services) || !result.services.length) throw new Error('Services are unavailable.');
  config = result; configLoaded = true; populateServices(); route();
}).catch(() => {
  $('#payment-availability').textContent = 'The booking server is unavailable. The website and chart still work; please call or WhatsApp us to arrange a reading.';
  $('#booking-submit').textContent = 'Booking server unavailable';
});
