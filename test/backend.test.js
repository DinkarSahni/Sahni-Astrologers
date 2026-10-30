import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/app.js';
import { hash, makePasswordHash } from '../server/security.js';
import { readConfig } from '../server/config.js';

const ORIGIN = 'http://localhost:3000';
const NOW = Date.parse('2030-01-07T03:00:00Z');
const KEY_SECRET = 'test-secret-32characters';
const WEBHOOK_SECRET = 'webhook-secret-32characters';
const ADMIN_PASSWORD = 'correct horse test administrator password';

function signed(secret, value) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

async function fixture(t, overrides = {}, { prepareDatabase } = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'sahni-payment-test-'));
  let currentTime = NOW;
  const payments = new Map();
  const orders = [];
  const provider = {
    async createOrder(input) {
      const order = { ...input, id: `order_test${orders.length + 1}`, status: 'created' };
      orders.push(order);
      return structuredClone(order);
    },
    async getPayment(id) {
      if (!payments.has(id)) throw new Error('Unknown payment');
      return structuredClone(payments.get(id));
    },
  };
  const config = {
    dataDir,
    siteUrl: ORIGIN,
    nodeEnv: 'test',
    port: 3000,
    trustProxy: 0,
    razorpayKeyId: 'rzp_test_unit',
    razorpayKeySecret: KEY_SECRET,
    razorpayWebhookSecret: WEBHOOK_SECRET,
    adminPasswordHash: makePasswordHash(ADMIN_PASSWORD),
    ...overrides,
  };
  if (prepareDatabase) await prepareDatabase(config);
  const backend = createApp(config, { paymentProvider: provider, now: () => currentTime });
  const server = await new Promise((resolve, reject) => {
    const listening = backend.app.listen(0, '127.0.0.1', () => resolve(listening));
    listening.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  let stopped = false;
  async function stop() {
    if (stopped) return;
    stopped = true;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    backend.close();
  }
  t.after(async () => {
    await stop();
    await rm(dataDir, { recursive: true, force: true });
  });

  async function request(path, { method = 'GET', body, raw, headers = {} } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(method !== 'GET' ? { Origin: ORIGIN } : {}),
        ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data, headers: response.headers };
  }

  function bookingBody(overrides = {}) {
    return {
      serviceId: 'kundali',
      name: 'Test Customer',
      phone: '+919876543210',
      email: 'customer@example.com',
      birthDate: '1990-01-01',
      birthTime: '10:20',
      birthPlace: 'Jalandhar, Punjab, India',
      date: '2030-01-07',
      time: '10:00',
      consent: true,
      accessToken: randomBytes(32).toString('hex'),
      ...overrides,
    };
  }

  async function book(body = bookingBody(), key = randomUUID()) {
    const result = await request('/api/bookings', {
      method: 'POST', body, headers: { 'Idempotency-Key': key },
    });
    return { ...result, body, key };
  }

  function paymentFor(booking, overrides = {}) {
    const id = `pay_test${payments.size + 1}`;
    const payment = {
      id, entity: 'payment', amount: 110000, currency: 'INR', status: 'captured',
      captured: true, order_id: booking.orderId, amount_refunded: 0,
      ...overrides,
    };
    payments.set(payment.id, payment);
    return payment;
  }

  function auth(booking) { return { Authorization: `Bearer ${booking.accessToken}` }; }

  async function verify(booking, payment, signature) {
    return request(`/api/bookings/${booking.bookingId}/verify`, {
      method: 'POST', headers: auth(booking), body: {
        razorpay_payment_id: payment.id,
        razorpay_order_id: booking.orderId,
        razorpay_signature: signature ?? signed(KEY_SECRET, `${booking.orderId}|${payment.id}`),
      },
    });
  }

  async function webhook(payment, eventId = randomUUID(), { signature, event = 'payment.captured', raw } = {}) {
    const payload = raw ?? JSON.stringify({ event, payload: { payment: { entity: payment } } });
    return request('/api/webhooks/razorpay', {
      method: 'POST', raw: payload, headers: {
        'X-Razorpay-Signature': signature ?? signed(WEBHOOK_SECRET, payload),
        'X-Razorpay-Event-Id': eventId,
      },
    });
  }

  return { ...backend, config, provider, request, bookingBody, book, paymentFor, verify, webhook, auth, orders, payments, stop,
    setTime: value => { currentTime = value; } };
}

test('catalog exposes only public configuration; booking prices come from server catalog', async t => {
  const f = await fixture(t);
  const catalog = await f.request('/api/config');
  assert.equal(catalog.status, 200);
  const service = catalog.data.services.find(s => s.id === 'kundali');
  assert.equal(service.amount, 110000);
  assert.equal(catalog.data.paymentsEnabled, true);
  assert.ok(!JSON.stringify(catalog.data).includes(KEY_SECRET));
  assert.ok(!JSON.stringify(catalog.data).includes(WEBHOOK_SECRET));
  const tampered = await f.book(f.bookingBody({ amount: 1, price: 1, currency: 'USD' }));
  if (tampered.status < 400) {
    assert.equal(tampered.data.amount, 110000);
    assert.equal(tampered.data.currency, 'INR');
    assert.equal(f.orders.at(-1).amount, 110000);
    assert.equal(f.orders.at(-1).currency, 'INR');
  } else {
    assert.equal(tampered.status, 400);
    assert.equal(f.orders.length, 0);
  }
});

test('Hindi Teva language persists through payment verification and restart into administrator records', async t => {
  for (const [serviceId, amount] of [['teva-digital', 70000], ['teva-physical', 90000]]) {
    await t.test(serviceId, async t => {
      const f = await fixture(t);
      const requestBody = f.bookingBody({ serviceId, date: undefined, time: undefined, tevaLanguage: 'hi',
        ...(serviceId === 'teva-physical' ? { address: '123 Test Road, Jalandhar, Punjab 144001' } : {}) });
      const created = await f.book(requestBody);
      assert.equal(created.status, 201, JSON.stringify(created.data));
      assert.equal(created.data.tevaLanguage, 'hi');
      assert.equal(created.data.amount, amount);
      assert.equal(created.data.currency, 'INR');
      assert.equal(f.db.prepare('SELECT teva_language FROM bookings WHERE id=?').get(created.data.bookingId).teva_language, 'hi');
      const order = f.orders[0];
      assert.deepEqual(Object.keys(order).sort(), ['amount', 'currency', 'id', 'notes', 'receipt', 'status']);
      assert.deepEqual(order.notes, { booking_id: created.data.bookingId });
      assert.equal(order.receipt, created.data.bookingId);
      assert.equal(order.amount, amount);
      const providerJson = JSON.stringify(order);
      for (const personal of [requestBody.name, requestBody.phone, requestBody.birthDate, requestBody.birthPlace, requestBody.address].filter(Boolean)) {
        assert.ok(!providerJson.includes(personal));
      }
      assert.ok(!providerJson.includes('tevaLanguage'));
      const payment = f.paymentFor(created.data, { amount });
      const verified = await f.verify(created.data, payment);
      assert.equal(verified.status, 200);
      assert.equal(verified.data.status, 'confirmed');
      assert.equal(verified.data.tevaLanguage, 'hi');
      const state = await f.request(`/api/bookings/${created.data.bookingId}`, { headers: f.auth(created.data) });
      assert.equal(state.data.tevaLanguage, 'hi');
      await f.stop();
      const restart = createApp(f.config, { paymentProvider: f.provider, now: () => NOW });
      let server;
      try {
        server = await new Promise((resolve, reject) => {
          const listening = restart.app.listen(0, '127.0.0.1', () => resolve(listening));
          listening.once('error', reject);
        });
        const base = `http://127.0.0.1:${server.address().port}`;
        const afterRestart = await fetch(`${base}/api/bookings/${created.data.bookingId}`, { headers: f.auth(created.data) });
        assert.equal((await afterRestart.json()).tevaLanguage, 'hi');
        const login = await fetch(`${base}/api/admin/login`, { method: 'POST',
          headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: ADMIN_PASSWORD }) });
        assert.equal(login.status, 200);
        const admin = await fetch(`${base}/api/admin/bookings`, { headers: { Cookie: login.headers.get('set-cookie').split(';')[0] } });
        assert.equal(admin.status, 200);
        const saved = (await admin.json()).bookings.find(row => row.bookingId === created.data.bookingId);
        assert.equal(saved.tevaLanguage, 'hi');
        assert.equal(saved.amount, amount);
      } finally {
        if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        restart.close();
      }
    });
  }
});

test('omitted Teva language defaults to English without changing other consultation responses', async t => {
  const f = await fixture(t);
  const digital = await f.book(f.bookingBody({ serviceId: 'teva-digital', date: undefined, time: undefined }));
  assert.equal(digital.status, 201);
  assert.equal(digital.data.tevaLanguage, 'en');
  assert.equal(digital.data.amount, 70000);
  assert.equal(f.db.prepare('SELECT teva_language FROM bookings WHERE id=?').get(digital.data.bookingId).teva_language, 'en');
  const consultation = await f.book();
  assert.equal(consultation.status, 201);
  assert.equal(consultation.data.amount, 110000);
  assert.ok(!Object.hasOwn(consultation.data, 'tevaLanguage'));
});

test('invalid Teva language is rejected before creating any booking or provider order', async t => {
  const f = await fixture(t);
  for (const tevaLanguage of ['fr', '', '<script>alert(1)</script>', null, 123]) {
    const attempt = await f.book(f.bookingBody({ serviceId: 'teva-digital', date: undefined, time: undefined, tevaLanguage }));
    assert.equal(attempt.status, 400);
  }
  assert.equal(f.orders.length, 0);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM bookings').get().n, 0);
});

test('legacy database migration keeps existing Teva records in English and preserves safe idempotent retries', async t => {
  const bookingId = randomUUID(), key = randomUUID(), accessToken = randomBytes(32).toString('hex');
  const oldRequest = { serviceId: 'teva-digital', name: 'Legacy Customer', phone: '+919876543210',
    email: 'legacy@example.com', birthDate: '1990-01-01', birthTime: '10:20', birthPlace: 'Jalandhar, Punjab, India',
    address: '', notes: '', consent: true, accessToken };
  const f = await fixture(t, {}, { prepareDatabase(config) {
    const legacy = new DatabaseSync(join(config.dataDir, 'sahni.sqlite'));
    try {
      legacy.exec(`CREATE TABLE bookings (
        id TEXT PRIMARY KEY, idempotency_hash TEXT UNIQUE NOT NULL, request_hash TEXT NOT NULL,
        token_hash TEXT NOT NULL, service_id TEXT NOT NULL, service_name TEXT NOT NULL,
        amount INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL,
        name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, birth_date TEXT NOT NULL,
        birth_time TEXT NOT NULL, birth_place TEXT NOT NULL, address TEXT NOT NULL, notes TEXT NOT NULL,
        appointment_date TEXT, appointment_time TEXT, hold_until INTEGER NOT NULL,
        order_id TEXT UNIQUE, payment_id TEXT UNIQUE, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      )`);
      assert.ok(!legacy.prepare('PRAGMA table_info(bookings)').all().some(column => column.name === 'teva_language'));
      legacy.prepare(`INSERT INTO bookings(id,idempotency_hash,request_hash,token_hash,service_id,service_name,
        amount,currency,status,name,phone,email,birth_date,birth_time,birth_place,address,notes,
        appointment_date,appointment_time,hold_until,order_id,payment_id,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        bookingId, hash(key), hash(JSON.stringify(oldRequest)), hash(accessToken), 'teva-digital', 'Digital Teva',
        70000, 'INR', 'awaiting_payment', oldRequest.name, oldRequest.phone, oldRequest.email,
        oldRequest.birthDate, oldRequest.birthTime, oldRequest.birthPlace, '', '', null, null,
        NOW + 20 * 60 * 1000, 'order_legacy1', null, NOW, NOW);
    } finally { legacy.close(); }
  } });
  const column = f.db.prepare('PRAGMA table_info(bookings)').all().find(item => item.name === 'teva_language');
  assert.ok(column);
  assert.equal(column.notnull, 1);
  assert.equal(f.db.prepare('SELECT teva_language FROM bookings WHERE id=?').get(bookingId).teva_language, 'en');
  const replay = await f.book(oldRequest, key);
  assert.equal(replay.status, 201, JSON.stringify(replay.data));
  assert.equal(replay.data.bookingId, bookingId);
  assert.equal(replay.data.orderId, 'order_legacy1');
  assert.equal(replay.data.tevaLanguage, 'en');
  assert.equal(replay.data.amount, 70000);
  assert.equal(f.orders.length, 0);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM bookings').get().n, 1);
});

test('booking creates a provider order with no birth/contact data and replays idempotently', async t => {
  const f = await fixture(t);
  const first = await f.book();
  assert.ok([200, 201].includes(first.status), JSON.stringify(first.data));
  assert.equal(first.data.amount, 110000);
  assert.ok(first.data.orderId.startsWith('order_'));
  assert.equal(first.data.accessToken, first.body.accessToken);
  assert.equal(f.orders.length, 1);
  const providerInput = JSON.stringify(f.orders[0]);
  for (const personal of [first.body.name, first.body.phone, first.body.email, first.body.birthDate, first.body.birthPlace]) {
    assert.ok(!providerInput.includes(personal), `Provider order leaked ${personal}`);
  }
  const replay = await f.book(first.body, first.key);
  assert.ok([200, 201].includes(replay.status), JSON.stringify(replay.data));
  assert.equal(replay.data.bookingId, first.data.bookingId);
  assert.equal(replay.data.orderId, first.data.orderId);
  assert.equal(f.orders.length, 1);
  const changed = await f.book({ ...first.body, serviceId: 'marriage' }, first.key);
  assert.equal(changed.status, 409);
  const hijack = await f.book({ ...first.body, accessToken: randomBytes(32).toString('hex') }, first.key);
  assert.ok([401, 403, 409].includes(hijack.status));
  assert.ok(!JSON.stringify(hijack.data).includes(first.data.accessToken));
});

test('simultaneous visitors cannot reserve the same appointment', async t => {
  const f = await fixture(t);
  const results = await Promise.all([f.book(), f.book()]);
  assert.equal(results.filter(r => r.status < 300).length, 1);
  assert.equal(results.filter(r => r.status === 409).length, 1);
  const availability = await f.request('/api/availability?date=2030-01-07');
  assert.equal(availability.status, 200);
  assert.ok(!availability.data.slots.includes('10:00'));
});

test('appointments use nonoverlapping 90-minute windows and respect Thursday and Sunday hours', async t => {
  const f = await fixture(t);
  const monday = await f.request('/api/availability?date=2030-01-07');
  assert.equal(monday.status, 200);
  assert.deepEqual(monday.data.slots, ['10:00', '11:30', '15:00']);
  const minutes = monday.data.slots.map(time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3)));
  assert.ok(minutes.every((minute, i) => i === 0 || minute - minutes[i - 1] >= 90));
  const thursday = await f.request('/api/availability?date=2030-01-10');
  assert.deepEqual(thursday.data.slots, ['15:00']);
  const sunday = await f.request('/api/availability?date=2030-01-13');
  assert.deepEqual(sunday.data.slots, []);
  const overlapping = await f.book(f.bookingBody({ time: '11:00' }));
  assert.equal(overlapping.status, 409);
});

test('booking status and verification require the unguessable bearer token', async t => {
  const f = await fixture(t);
  const { data: booking } = await f.book();
  const missing = await f.request(`/api/bookings/${booking.bookingId}`);
  assert.ok([401, 403, 404].includes(missing.status));
  const wrong = await f.request(`/api/bookings/${booking.bookingId}`, { headers: { Authorization: `Bearer ${'a'.repeat(64)}` } });
  assert.ok([401, 403, 404].includes(wrong.status));
  const allowed = await f.request(`/api/bookings/${booking.bookingId}`, { headers: f.auth(booking) });
  assert.equal(allowed.status, 200);
  assert.notEqual(allowed.data.status, 'confirmed');
  assert.ok(!JSON.stringify(allowed.data).includes('customer@example.com'));
});

test('forged checkout success cannot confirm a booking', async t => {
  const f = await fixture(t);
  const { data: booking } = await f.book();
  const payment = f.paymentFor(booking);
  const result = await f.verify(booking, payment, '0'.repeat(64));
  assert.ok([400, 401, 403].includes(result.status));
  const state = await f.request(`/api/bookings/${booking.bookingId}`, { headers: f.auth(booking) });
  assert.notEqual(state.data.status, 'confirmed');
});

test('valid signature still requires a matching, captured provider payment', async t => {
  for (const overrides of [
    { amount: 1 },
    { currency: 'USD' },
    { order_id: 'order_different' },
    { id: 'pay_alternate' },
  ]) {
    await t.test(JSON.stringify(overrides), async t => {
      const f = await fixture(t);
      const { data: booking } = await f.book();
      const payment = f.paymentFor(booking, overrides);
      let result;
      if (overrides.id) {
        f.payments.set('pay_requested', payment);
        result = await f.verify(booking, { ...payment, id: 'pay_requested' });
      } else {
        result = await f.verify(booking, payment);
      }
      assert.ok(result.status >= 400 || result.data.status !== 'confirmed', JSON.stringify(result.data));
      const state = await f.request(`/api/bookings/${booking.bookingId}`, { headers: f.auth(booking) });
      assert.notEqual(state.data.status, 'confirmed');
    });
  }
});

test('authorized payment stays pending until capture, then confirms idempotently', async t => {
  const f = await fixture(t);
  const { data: booking } = await f.book();
  const payment = f.paymentFor(booking, { status: 'authorized', captured: false });
  const pending = await f.verify(booking, payment);
  assert.equal(pending.status, 200);
  assert.equal(pending.data.status, 'payment_pending');
  f.payments.set(payment.id, { ...payment, status: 'captured', captured: true });
  const captured = await f.verify(booking, payment);
  assert.equal(captured.status, 200);
  assert.equal(captured.data.status, 'confirmed');
  const replay = await f.verify(booking, payment);
  assert.equal(replay.status, 200);
  assert.equal(replay.data.status, 'confirmed');
});

test('webhook validates exact raw body and cannot trust a captured claim alone', async t => {
  const f = await fixture(t);
  const { data: booking } = await f.book();
  const payment = f.paymentFor(booking, { amount: 1 });
  const forged = await f.webhook(payment, randomUUID(), { signature: '0'.repeat(64) });
  assert.ok([400, 401, 403].includes(forged.status));
  const wrongAmount = await f.webhook({ ...payment, amount: 110000 });
  const state = await f.request(`/api/bookings/${booking.bookingId}`, { headers: f.auth(booking) });
  assert.notEqual(state.data.status, 'confirmed');
  assert.ok(wrongAmount.status >= 400 || state.data.status === 'manual_review');
});

test('signed captured webhook confirms without trusting a browser callback and deduplicates events', async t => {
  const f = await fixture(t);
  const { data: booking } = await f.book();
  const payment = f.paymentFor(booking);
  const eventId = randomUUID();
  const first = await f.webhook(payment, eventId);
  assert.ok([200, 204].includes(first.status), JSON.stringify(first.data));
  const replay = await f.webhook(payment, eventId);
  assert.ok([200, 204].includes(replay.status), JSON.stringify(replay.data));
  const state = await f.request(`/api/bookings/${booking.bookingId}`, { headers: f.auth(booking) });
  assert.equal(state.data.status, 'confirmed');
  const conflicting = await f.book();
  assert.equal(conflicting.status, 409);
});

test('late captured payment cannot displace a second customer after the original hold expires', async t => {
  const f = await fixture(t);
  const { data: first } = await f.book(f.bookingBody({ time: '11:30' }));
  f.setTime(NOW + 60 * 60 * 1000);
  const second = await f.book(f.bookingBody({ name: 'Second Customer', time: '11:30' }));
  assert.ok([200, 201].includes(second.status), JSON.stringify(second.data));
  const firstPayment = f.paymentFor(first);
  const late = await f.verify(first, firstPayment);
  assert.equal(late.status, 200);
  assert.equal(late.data.status, 'manual_review');
  const secondPayment = f.paymentFor(second.data);
  const confirmed = await f.verify(second.data, secondPayment);
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.data.status, 'confirmed');
  const firstState = await f.request(`/api/bookings/${first.bookingId}`, { headers: f.auth(first) });
  assert.equal(firstState.data.status, 'manual_review');
});

test('a failed first payment attempt does not block a later captured attempt for the same order', async t => {
  const f = await fixture(t);
  const { data: booking } = await f.book();
  const firstPayment = f.paymentFor(booking, { status: 'authorized', captured: false });
  assert.equal((await f.verify(booking, firstPayment)).data.status, 'payment_pending');
  f.payments.set(firstPayment.id, { ...firstPayment, status: 'failed', captured: false });
  const successfulRetry = f.paymentFor(booking);
  const result = await f.verify(booking, successfulRetry);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.status, 'confirmed');
});

test('a verified full refund releases the slot and cannot be reversed by a stale captured snapshot', async t => {
  const f = await fixture(t);
  const { data: booking } = await f.book();
  const payment = f.paymentFor(booking);
  assert.equal((await f.verify(booking, payment)).data.status, 'confirmed');
  f.payments.set(payment.id, { ...payment, amount_refunded: payment.amount, status: 'refunded' });
  const refund = await f.webhook(payment, randomUUID(), { event: 'payment.refunded' });
  assert.equal(refund.status, 200, JSON.stringify(refund.data));
  const state = await f.request(`/api/bookings/${booking.bookingId}`, { headers: f.auth(booking) });
  assert.equal(state.data.status, 'refunded');
  const availability = await f.request('/api/availability?date=2030-01-07');
  assert.ok(availability.data.slots.includes('10:00'));
  f.payments.set(payment.id, payment);
  const replay = await f.verify(booking, payment);
  assert.ok(replay.status >= 400 || replay.data.status === 'refunded' || replay.data.status === 'manual_review');
});

test('provider outages fail closed and retry the same booking without leaking provider errors', async t => {
  const f = await fixture(t);
  const createOrder = f.provider.createOrder;
  f.provider.createOrder = async () => { throw new Error(`provider failed ${KEY_SECRET}`); };
  const body = f.bookingBody();
  const key = randomUUID();
  const failed = await f.book(body, key);
  assert.equal(failed.status, 503);
  assert.ok(!JSON.stringify(failed.data).includes(KEY_SECRET));
  f.provider.createOrder = createOrder;
  const retry = await f.book(body, key);
  assert.equal(retry.status, 201, JSON.stringify(retry.data));
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM bookings').get().n, 1);
  const payment = f.paymentFor(retry.data);
  const getPayment = f.provider.getPayment;
  f.provider.getPayment = async () => { throw new Error(`provider unavailable ${KEY_SECRET}`); };
  const unverified = await f.verify(retry.data, payment);
  assert.equal(unverified.status, 503);
  assert.ok(!JSON.stringify(unverified.data).includes(KEY_SECRET));
  f.provider.getPayment = getPayment;
  assert.equal((await f.verify(retry.data, payment)).data.status, 'confirmed');
});

test('two distinct captured payments are flagged for manual review rather than silently ignored', async t => {
  const f = await fixture(t);
  const { data: booking } = await f.book();
  const first = f.paymentFor(booking);
  assert.equal((await f.verify(booking, first)).data.status, 'confirmed');
  const duplicateCharge = f.paymentFor(booking);
  const result = await f.verify(booking, duplicateCharge);
  assert.equal(result.status, 200);
  assert.equal(result.data.status, 'manual_review');
  const attempts = f.db.prepare('SELECT payment_id FROM payment_attempts WHERE booking_id=?').all(booking.bookingId);
  assert.deepEqual(new Set(attempts.map(a => a.payment_id)), new Set([first.id, duplicateCharge.id]));
});

test('an expired reservation cannot be re-established by late payment after an administrator closes the slot', async t => {
  const f = await fixture(t);
  const { data: booking } = await f.book(f.bookingBody({ time: '11:30' }));
  f.setTime(NOW + 60 * 60 * 1000);
  const login = await f.request('/api/admin/login', { method: 'POST', body: { password: ADMIN_PASSWORD } });
  const closure = await f.request('/api/admin/closures', {
    method: 'POST', body: { date: '2030-01-07', time: '11:30' },
    headers: { Cookie: login.headers.get('set-cookie').split(';')[0], 'X-CSRF-Token': login.data.csrfToken },
  });
  assert.equal(closure.status, 201);
  const late = await f.verify(booking, f.paymentFor(booking));
  assert.equal(late.status, 200);
  assert.equal(late.data.status, 'manual_review');
  assert.equal(f.db.prepare('SELECT * FROM reservations WHERE booking_id=?').get(booking.bookingId), undefined);
});

test('slow order creation finishing after expiry cannot revive a reservation or take another customer slot', async t => {
  const f = await fixture(t);
  const originalCreate = f.provider.createOrder;
  let signalStarted, release;
  const started = new Promise(resolve => { signalStarted = resolve; });
  const delayed = new Promise(resolve => { release = resolve; });
  let first = true;
  f.provider.createOrder = async input => {
    if (first) { first = false; signalStarted(); await delayed; }
    return originalCreate(input);
  };
  const pending = f.book(f.bookingBody({ time: '11:30' }));
  await Promise.race([started, pending.then(result => { throw new Error(`Expected provider order creation, got HTTP ${result.status}`); })]);
  f.setTime(NOW + 60 * 60 * 1000);
  const second = await f.book(f.bookingBody({ name: 'Second Customer', time: '11:30' }));
  assert.equal(second.status, 201);
  release();
  const expired = await pending;
  assert.equal(expired.status, 409);
  const reservation = f.db.prepare('SELECT booking_id FROM reservations WHERE date=? AND time=?').get('2030-01-07', '11:30');
  assert.equal(reservation.booking_id, second.data.bookingId);
});

test('malformed input and signed malformed webhooks fail without leaking data or crashing', async t => {
  const f = await fixture(t);
  const marker = 'private-test-content-should-never-be-echoed';
  for (const raw of [`{"message":"${marker}"`, JSON.stringify({ message: marker.repeat(2000) }), 'null', '[]']) {
    const response = await f.request('/api/contact', { method: 'POST', raw });
    assert.ok(response.status >= 400);
    assert.ok(!JSON.stringify(response.data).includes(marker));
  }
  for (const raw of ['null', '[]', '{"event":"payment.captured"}', '{']) {
    const response = await f.webhook(null, randomUUID(), { raw });
    assert.ok(response.status >= 400 || response.data.received === true);
    assert.ok(!JSON.stringify(response.data).includes('TypeError'));
    assert.ok(!JSON.stringify(response.data).includes('server/app.js'));
  }
  assert.equal((await f.request('/api/health')).status, 200);
});

test('payment configuration fails closed when credentials are unavailable', async t => {
  const f = await fixture(t, { razorpayKeyId: '', razorpayKeySecret: '', razorpayWebhookSecret: '' });
  const config = await f.request('/api/config');
  assert.equal(config.data.paymentsEnabled, false);
  const attempt = await f.book();
  assert.equal(attempt.status, 503);
  assert.equal(f.orders.length, 0);
});

test('persistent payment data cannot switch between Razorpay test and live modes', async t => {
  for (const initialMode of ['test', 'live']) {
    await t.test(`${initialMode} database stays isolated`, async t => {
      const f = await fixture(t, {
        razorpayKeyId: `rzp_${initialMode}_unit`,
        ...(initialMode === 'live' ? { nodeEnv: 'production', siteUrl: 'https://sahni.example' } : {}),
      });
      const oppositeMode = initialMode === 'test' ? 'live' : 'test';
      assert.throws(() => createApp({ ...f.config, nodeEnv: 'production', siteUrl: 'https://sahni.example', razorpayKeyId: `rzp_${oppositeMode}_unit` }, {
        paymentProvider: f.provider, now: () => NOW,
      }), /different Razorpay mode|separate persistent DATA_DIR/);
      const restart = createApp(f.config, { paymentProvider: f.provider, now: () => NOW });
      assert.equal(restart.db.prepare("SELECT value FROM environment_meta WHERE name='payment_mode'").get().value, initialMode);
      restart.close();
      const disabled = createApp({ ...f.config, razorpayKeyId: '', razorpayKeySecret: '', razorpayWebhookSecret: '' }, {
        paymentProvider: f.provider, now: () => NOW,
      });
      const server = await new Promise((resolve, reject) => {
        const listening = disabled.app.listen(0, '127.0.0.1', () => resolve(listening));
        listening.once('error', reject);
      });
      try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/config`);
        assert.equal(response.status, 200);
        const config = await response.json();
        assert.equal(config.paymentMode, initialMode);
        assert.equal(config.paymentsEnabled, false);
      } finally {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        disabled.close();
      }
    });
  }
});

test('live Razorpay configuration requires production HTTPS and configured administrator credentials', async t => {
  const f = await fixture(t);
  const secureEnv = {
    NODE_ENV: 'production', SITE_URL: 'https://sahni.example',
    RAZORPAY_KEY_ID: 'rzp_live_unit', RAZORPAY_KEY_SECRET: KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET, ADMIN_PASSWORD_HASH: f.config.adminPasswordHash,
  };
  const secure = readConfig(secureEnv);
  assert.equal(secure.nodeEnv, 'production');
  assert.equal(secure.siteUrl, 'https://sahni.example');
  for (const change of [
    { NODE_ENV: 'development' },
    { SITE_URL: 'http://sahni.example' },
    { ADMIN_PASSWORD_HASH: '' },
  ]) {
    assert.throws(() => readConfig({ ...secureEnv, ...change }), /production|HTTPS|ADMIN_PASSWORD_HASH/);
  }
  for (const change of [
    { nodeEnv: 'development', siteUrl: 'https://sahni.example' },
    { nodeEnv: 'production', siteUrl: 'http://sahni.example' },
    { nodeEnv: 'production', siteUrl: 'https://sahni.example', adminPasswordHash: '' },
  ]) {
    assert.throws(() => createApp({ ...f.config, razorpayKeyId: 'rzp_live_unit', ...change }, {
      paymentProvider: f.provider, now: () => NOW,
    }), /production|HTTPS|ADMIN_PASSWORD_HASH/);
  }
});

test('cross-site writes are refused, source files and private storage are never served', async t => {
  const f = await fixture(t);
  const csrf = await f.request('/api/contact', {
    method: 'POST', headers: { Origin: 'https://attacker.example' },
    body: { name: 'Test', contact: 'test@example.com', topic: 'Other', message: 'Hello', consent: true },
  });
  assert.equal(csrf.status, 403);
  for (const path of ['/server/app.js', '/.env', '/package.json', '/.git/config', '/.data/bookings.sqlite']) {
    const response = await f.request(path);
    assert.ok(response.status >= 400, `Private path served: ${path}`);
  }
});

test('admin data requires login and state changes require session plus CSRF', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/admin/bookings')).status, 401);
  const denied = await f.request('/api/admin/login', { method: 'POST', body: { password: 'incorrect' } });
  assert.ok([401, 403].includes(denied.status));
  const login = await f.request('/api/admin/login', { method: 'POST', body: { password: ADMIN_PASSWORD } });
  assert.equal(login.status, 200, JSON.stringify(login.data));
  assert.ok(login.data.csrfToken);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(login.headers.get('set-cookie'), /SameSite=Strict/i);
  assert.equal((await f.request('/api/admin/bookings', { headers: { Cookie: cookie } })).status, 200);
  const noCsrf = await f.request('/api/admin/logout', { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(noCsrf.status, 403);
  const logout = await f.request('/api/admin/logout', {
    method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': login.data.csrfToken },
  });
  assert.equal(logout.status, 200);
  assert.equal((await f.request('/api/admin/bookings', { headers: { Cookie: cookie } })).status, 401);
});

test('removing or rotating administrator credentials revokes existing sessions on restart', async t => {
  for (const mode of ['removed', 'rotated']) {
    await t.test(mode, async t => {
      const f = await fixture(t);
      const login = await f.request('/api/admin/login', { method: 'POST', body: { password: ADMIN_PASSWORD } });
      assert.equal(login.status, 200);
      const cookie = login.headers.get('set-cookie').split(';')[0];
      assert.equal((await f.request('/api/admin/bookings', { headers: { Cookie: cookie } })).status, 200);
      const adminPasswordHash = mode === 'removed' ? '' : makePasswordHash('a different strong administrator password');
      const restart = createApp({ ...f.config, adminPasswordHash }, { paymentProvider: f.provider, now: () => NOW });
      assert.equal(restart.db.prepare('SELECT count(*) AS n FROM admin_sessions').get().n, 0);
      restart.close();
      assert.equal((await f.request('/api/admin/bookings', { headers: { Cookie: cookie } })).status, 401);
    });
  }
});
