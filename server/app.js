import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { createHmac, randomUUID } from 'node:crypto';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { SERVICES, SLOT_TIMES, TIMEZONE, validDate, todayIndia, slotIsInSchedule, appointmentTimestamp } from './catalog.js';
import { paymentConfiguration, assertLiveConfiguration } from './config.js';
import { openDatabase, transaction } from './database.js';
import { createRazorpayProvider } from './razorpay.js';
import { hash, token, safeEqual, checkPassword, validPasswordHash } from './security.js';
import { renderPublicPage, robotsText, sitemapXml } from './seo.js';

const PUBLIC = resolve(fileURLToPath(new URL('../public', import.meta.url)));
const HOLD_MS = 20 * 60 * 1000;
const SESSION_MS = 8 * 60 * 60 * 1000;
const text = (min, max) => z.string().trim().min(min).max(max).refine(v => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(v));
const dateField = z.string().refine(validDate);
const timeField = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const paymentId = z.string().regex(/^pay_[A-Za-z0-9]+$/).max(100);
const orderId = z.string().regex(/^order_[A-Za-z0-9]+$/).max(100);
const bookingSchema = z.object({
  serviceId: z.enum(SERVICES.map(s => s.id)), name: text(2, 100),
  phone: text(7, 25).refine(v => /^\+?[\d ()-]+$/.test(v) && v.replace(/\D/g, '').length >= 7),
  email: z.union([z.email().max(254), z.literal('')]).optional().default(''),
  birthDate: dateField, birthTime: timeField, birthPlace: text(2, 200),
  address: text(0, 500).optional().default(''), notes: text(0, 2000).optional().default(''),
  date: dateField.optional(), time: timeField.optional(), consent: z.literal(true),
  accessToken: z.string().regex(/^[a-f0-9]{64}$/),
  tevaLanguage: z.enum(['en', 'hi']).optional().default('en'),
}).strict();
const verifySchema = z.object({ razorpay_payment_id: paymentId, razorpay_order_id: orderId, razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const contactSchema = z.object({ name: text(2, 100), contact: text(5, 254), topic: text(1, 100), message: text(5, 3000), consent: z.literal(true) }).strict();
function httpError(status, code, message) { return Object.assign(new Error(message), { status, code }); }
function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) throw httpError(400, 'INVALID_INPUT', 'Check the supplied details and try again.');
  return r.data;
}
function publicBooking(row) {
  return { bookingId: row.id, status: row.status, amount: row.amount, currency: row.currency,
    serviceName: row.service_name, date: row.appointment_date, time: row.appointment_time,
    holdExpiresAt: new Date(row.hold_until).toISOString(), orderId: row.order_id,
    ...(row.service_id.startsWith('teva-') ? { tevaLanguage: row.teva_language } : {}) };
}

export function createApp(config, { paymentProvider, now = () => Date.now() } = {}) {
  assertLiveConfiguration(config);
  if (resolve(config.dataDir) === PUBLIC || resolve(config.dataDir).startsWith(PUBLIC + sep)) throw new Error('DATA_DIR must be outside public/.');
  const db = openDatabase(config.dataDir);
  const app = express();
  const payments = paymentConfiguration(config);
  const storedMode = db.prepare("SELECT value FROM environment_meta WHERE name='payment_mode'").get()?.value;
  if (storedMode && payments.mode && storedMode !== payments.mode) {
    db.close();
    throw new Error('This DATA_DIR belongs to a different Razorpay mode. Use a separate persistent DATA_DIR for live and test payments.');
  }
  if (!storedMode && payments.mode) db.prepare("INSERT INTO environment_meta(name,value) VALUES('payment_mode',?)").run(payments.mode);
  const paymentMode = payments.mode || storedMode || null;
  const adminEnabled = validPasswordHash(config.adminPasswordHash);
  const adminDigest = adminEnabled ? hash(config.adminPasswordHash) : '';
  const oldAdminDigest = db.prepare("SELECT value FROM environment_meta WHERE name='admin_credential_digest'").get()?.value;
  if (!adminEnabled || oldAdminDigest !== adminDigest) {
    // Removing or rotating the password also revokes previously issued cookies.
    transaction(db, () => {
      db.prepare('DELETE FROM admin_sessions').run();
      db.prepare("INSERT INTO environment_meta(name,value) VALUES('admin_credential_digest',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value").run(adminDigest);
    });
  }
  const provider = paymentProvider || createRazorpayProvider(config);
  const cookieName = config.nodeEnv === 'production' ? '__Host-sahni_admin' : 'sahni_admin';
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy || false);
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'", 'https://checkout.razorpay.com', 'https://*.razorpay.com'],
    scriptSrcAttr: ["'none'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'], imgSrc: ["'self'", 'data:', 'https://*.razorpay.com'],
    connectSrc: ["'self'", 'https://*.razorpay.com'], frameSrc: ['https://*.razorpay.com', 'https://www.google.com'],
    objectSrc: ["'none'"], baseUri: ["'none'"], formAction: ["'self'"], frameAncestors: ["'none'"],
    upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null,
  } }, referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: config.nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
  }));
  app.use((_req, res, next) => { res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); next(); });
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  function expireHolds() {
    transaction(db, () => {
      db.prepare(`DELETE FROM reservations WHERE booking_id IN (SELECT id FROM bookings WHERE hold_until <= ? AND status IN ('awaiting_order','awaiting_payment','payment_pending','order_failed','expired'))`).run(now());
      db.prepare(`UPDATE bookings SET status='expired', updated_at=? WHERE hold_until<=? AND status IN ('awaiting_order','awaiting_payment','payment_pending','order_failed')`).run(now(), now());
      db.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').run(now());
    });
  }
  function closed(date, time) { return Boolean(db.prepare('SELECT id FROM closures WHERE date=? AND (time IS NULL OR time=?)').get(date, time)); }
  function slotAvailable(date, time) { return slotIsInSchedule(date, time, now()) && !closed(date, time) && !db.prepare('SELECT booking_id FROM reservations WHERE date=? AND time=?').get(date, time); }
  function requirePayments() { if (!payments.enabled) throw httpError(503, 'PAYMENTS_UNAVAILABLE', 'Online payments are not configured. Please contact us to arrange a booking.'); }
  function authorizeBooking(req) {
    const row = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
    const bearer = /^Bearer ([a-f0-9]{64})$/.exec(req.get('Authorization') || '');
    if (!row || !bearer || !safeEqual(hash(bearer[1]), row.token_hash)) throw httpError(404, 'NOT_FOUND', 'Booking not found.');
    return row;
  }
  function matchingPayment(row, p, expectedId) {
    return p && p.id === expectedId && p.order_id === row.order_id && Number.isSafeInteger(p.amount)
      && p.amount === row.amount && p.currency === row.currency
      && (p.amount_refunded === undefined || (Number.isSafeInteger(p.amount_refunded) && p.amount_refunded >= 0 && p.amount_refunded <= row.amount));
  }
  async function applyPayment(row, id) {
    let p;
    try { p = await provider.getPayment(id); }
    catch { throw httpError(503, 'PAYMENT_CHECK_UNAVAILABLE', 'Payment verification is temporarily unavailable. Your booking is not yet confirmed. Please retry.'); }
    if (!matchingPayment(row, p, id)) throw httpError(400, 'PAYMENT_MISMATCH', 'The payment does not match this booking.');
    expireHolds();
    return transaction(db, () => {
      const current = db.prepare('SELECT * FROM bookings WHERE id=?').get(row.id);
      const other = db.prepare('SELECT booking_id FROM payment_attempts WHERE payment_id=? AND booking_id<>?').get(id, row.id);
      if (other) throw httpError(409, 'PAYMENT_ALREADY_USED', 'This payment is already linked to a booking.');
      const previousAttempt = db.prepare('SELECT * FROM payment_attempts WHERE payment_id=?').get(id);
      const refunded = Number(p.amount_refunded || 0);
      // Event delivery and provider replicas can be out of order: observed captures
      // and refund amounts are monotonic for a single payment.
      const canonicalStatus = previousAttempt && ['captured','refunded'].includes(previousAttempt.status) && !['captured','refunded'].includes(p.status) ? previousAttempt.status : p.status;
      const totalRefunded = Math.max(refunded, previousAttempt?.amount_refunded || 0);
      db.prepare(`INSERT INTO payment_attempts(payment_id,booking_id,status,amount_refunded,updated_at) VALUES(?,?,?,?,?)
        ON CONFLICT(payment_id) DO UPDATE SET status=excluded.status,amount_refunded=excluded.amount_refunded,updated_at=excluded.updated_at`).run(id, row.id, canonicalStatus, totalRefunded, now());
      const otherCapture = db.prepare("SELECT payment_id FROM payment_attempts WHERE booking_id=? AND payment_id<>? AND status='captured' AND amount_refunded<?").get(row.id, id, row.amount);
      let status;
      let linkedPayment = current.payment_id;
      if (current.status === 'refunded') {
        // A later second charge needs human review; old captured events cannot
        // resurrect a refunded appointment.
        status = p.status === 'captured' && p.captured === true && id !== current.payment_id && totalRefunded === 0 ? 'manual_review' : 'refunded';
      } else if (totalRefunded > 0) {
        status = current.status === 'manual_review' || otherCapture || (current.payment_id && current.payment_id !== id && current.status === 'confirmed') ? 'manual_review' : totalRefunded >= row.amount ? 'refunded' : 'manual_review';
        linkedPayment ||= id;
        if (status === 'refunded') db.prepare('DELETE FROM reservations WHERE booking_id=?').run(row.id);
      } else if (p.status === 'captured' && p.captured === true) {
        const reservation = current.appointment_date ? db.prepare('SELECT booking_id FROM reservations WHERE date=? AND time=?').get(current.appointment_date, current.appointment_time) : null;
        const conflict = (reservation && reservation.booking_id !== row.id) || (current.appointment_date && !reservation && closed(current.appointment_date, current.appointment_time));
        const tooLate = current.appointment_date && appointmentTimestamp(current.appointment_date, current.appointment_time) <= now();
        status = conflict || tooLate || otherCapture || current.status === 'manual_review' ? 'manual_review' : 'confirmed';
        if (!['confirmed','manual_review'].includes(current.status) || !linkedPayment) linkedPayment = id;
        if (status === 'confirmed' && current.appointment_date && !reservation) db.prepare('INSERT INTO reservations(date,time,booking_id) VALUES(?,?,?)').run(current.appointment_date, current.appointment_time, row.id);
      } else if (p.status === 'authorized' && !['confirmed','refunded','manual_review'].includes(current.status)) {
        status = current.hold_until > now() ? 'payment_pending' : 'expired';
        linkedPayment = id;
      } else {
        // Never downgrade an already verified capture because an old event was replayed.
        status = ['confirmed','refunded','manual_review'].includes(current.status) ? current.status : current.hold_until > now() ? 'awaiting_payment' : 'expired';
      }
      db.prepare('UPDATE bookings SET status=?,payment_id=?,updated_at=? WHERE id=?').run(status, linkedPayment, now(), row.id);
      return db.prepare('SELECT * FROM bookings WHERE id=?').get(row.id);
    });
  }
  const webhookLimiter = rateLimit({ windowMs: 60000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false });
  app.post('/api/webhooks/razorpay', webhookLimiter, express.raw({ type: 'application/json', limit: '128kb' }), async (req, res, next) => {
    try {
      requirePayments();
      if (!Buffer.isBuffer(req.body)) throw httpError(400, 'INVALID_WEBHOOK', 'Expected a JSON webhook.');
      const signature = req.get('x-razorpay-signature') || '';
      const expected = createHmac('sha256', config.razorpayWebhookSecret).update(req.body).digest('hex');
      if (!/^[a-f0-9]{64}$/.test(signature) || !safeEqual(signature, expected)) throw httpError(400, 'INVALID_SIGNATURE', 'Invalid webhook signature.');
      let event;
      try { event = JSON.parse(req.body.toString('utf8')); } catch { throw httpError(400, 'INVALID_WEBHOOK', 'Invalid webhook JSON.'); }
      if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.event !== 'string') throw httpError(400, 'INVALID_WEBHOOK', 'Invalid webhook event.');
      const eventId = req.get('x-razorpay-event-id') || hash(req.body);
      if (eventId.length > 200) throw httpError(400, 'INVALID_WEBHOOK', 'Invalid event identifier.');
      if (db.prepare('SELECT id FROM webhook_events WHERE id=?').get(eventId)) return res.json({ received: true });
      if (!['payment.captured','payment.authorized','order.paid','payment.refunded','refund.processed'].includes(event.event)) return res.json({ received: true });
      const entity = event.payload?.payment?.entity;
      const id = entity?.id || event.payload?.refund?.entity?.payment_id;
      if (!paymentId.safeParse(id).success) throw httpError(400, 'INVALID_WEBHOOK', 'Missing payment identifier.');
      let row = entity?.order_id ? db.prepare('SELECT * FROM bookings WHERE order_id=?').get(entity.order_id) : db.prepare('SELECT b.* FROM bookings b LEFT JOIN payment_attempts p ON p.booking_id=b.id WHERE b.payment_id=? OR p.payment_id=? LIMIT 1').get(id, id);
      if (!row) return res.json({ received: true });
      await applyPayment(row, id);
      db.prepare('INSERT OR IGNORE INTO webhook_events(id,received_at) VALUES(?,?)').run(eventId, now());
      res.json({ received: true });
    } catch (e) { next(e); }
  });

  app.use('/api', rateLimit({ windowMs: 60000, limit: config.nodeEnv === 'test' ? 2000 : 120, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(express.json({ limit: '24kb', strict: true }));
  app.use('/api', (req, _res, next) => {
    if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if (origin !== config.siteUrl || (req.get('sec-fetch-site') && req.get('sec-fetch-site') !== 'same-origin')) return next(httpError(403, 'CROSS_ORIGIN', 'This request must come from this website.'));
    }
    next();
  });
  app.get('/api/health', (_req, res) => { db.prepare('SELECT 1').get(); res.json({ ok: true }); });
  app.get('/api/config', (_req, res) => res.json({ services: SERVICES, paymentsEnabled: payments.enabled, paymentMode, businessTimezone: TIMEZONE }));
  app.get('/api/availability', (req, res) => {
    const date = parse(dateField, req.query.date); expireHolds();
    res.json({ date, slots: SLOT_TIMES.filter(time => slotAvailable(date, time)) });
  });
  const bookingLimiter = rateLimit({ windowMs: 60 * 60000, limit: config.nodeEnv === 'test' ? 1000 : 12, standardHeaders: 'draft-8', legacyHeaders: false });
  const creatingOrders = new Map();
  app.post('/api/bookings', bookingLimiter, async (req, res, next) => {
    try {
      requirePayments();
      const data = parse(bookingSchema, req.body);
      const idempotencyKey = parse(z.uuid(), req.get('Idempotency-Key'));
      if (data.birthDate < '1900-01-01' || data.birthDate > todayIndia(now())) throw httpError(400, 'INVALID_BIRTH_DATE', 'Enter a birth date from 1900 through today.');
      const service = SERVICES.find(s => s.id === data.serviceId);
      if (service.requiresAddress && data.address.length < 10) throw httpError(400, 'ADDRESS_REQUIRED', 'Enter a full delivery address.');
      if (service.requiresSlot && (!data.date || !data.time)) throw httpError(400, 'SLOT_REQUIRED', 'Choose an appointment date and time.');
      if (!service.requiresSlot && (data.date || data.time)) throw httpError(400, 'INVALID_SLOT', 'This service does not require an appointment slot.');
      // Keep English/default request hashes compatible with pre-language
      // bookings so a safe retry after an application upgrade still works.
      const requestDetails = { ...data };
      if (!service.id.startsWith('teva-') || data.tevaLanguage === 'en') delete requestDetails.tevaLanguage;
      const requestHash = hash(JSON.stringify(requestDetails));
      expireHolds();
      let row = transaction(db, () => {
        const existing = db.prepare('SELECT * FROM bookings WHERE idempotency_hash=?').get(hash(idempotencyKey));
        if (existing) {
          if (!safeEqual(existing.request_hash, requestHash)) throw httpError(409, 'IDEMPOTENCY_CONFLICT', 'This request identifier was already used for different details.');
          return existing;
        }
        if (service.requiresSlot && !slotAvailable(data.date, data.time)) throw httpError(409, 'SLOT_UNAVAILABLE', 'This appointment time is unavailable. Choose another time.');
        const id = randomUUID();
        db.prepare(`INSERT INTO bookings(id,idempotency_hash,request_hash,token_hash,service_id,service_name,amount,currency,status,name,phone,email,birth_date,birth_time,birth_place,address,notes,appointment_date,appointment_time,hold_until,created_at,updated_at,teva_language)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, hash(idempotencyKey), requestHash, hash(data.accessToken), service.id, service.name, service.amount, service.currency, 'awaiting_order', data.name, data.phone, data.email, data.birthDate, data.birthTime, data.birthPlace, data.address, data.notes, data.date || null, data.time || null, now() + HOLD_MS, now(), now(), service.id.startsWith('teva-') ? data.tevaLanguage : 'en');
        if (service.requiresSlot) db.prepare('INSERT INTO reservations(date,time,booking_id) VALUES(?,?,?)').run(data.date, data.time, id);
        return db.prepare('SELECT * FROM bookings WHERE id=?').get(id);
      });
      if (row.status === 'expired') throw httpError(409, 'HOLD_EXPIRED', 'Your reservation expired. Please choose a time and begin again.');
      if (!row.order_id) {
        if (creatingOrders.has(row.id)) await creatingOrders.get(row.id);
        else {
          const promise = (async () => {
            let order;
            try { order = await provider.createOrder({ amount: row.amount, currency: row.currency, receipt: row.id, notes: { booking_id: row.id } }); }
            catch { throw httpError(503, 'ORDER_UNAVAILABLE', 'Unable to open payments right now. Your request can be retried safely.'); }
            if (!orderId.safeParse(order?.id).success || order.amount !== row.amount || order.currency !== row.currency) throw httpError(503, 'ORDER_UNAVAILABLE', 'The payment provider returned an unexpected order. Please contact us.');
            // Order creation is outside the database transaction. It may finish
            // after a hold expires, so never revive that hold here.
            db.prepare("UPDATE bookings SET order_id=?,status=CASE WHEN hold_until>? AND status='awaiting_order' THEN 'awaiting_payment' ELSE status END,updated_at=? WHERE id=? AND order_id IS NULL").run(order.id, now(), now(), row.id);
          })();
          creatingOrders.set(row.id, promise);
          try { await promise; } finally { creatingOrders.delete(row.id); }
        }
        row = db.prepare('SELECT * FROM bookings WHERE id=?').get(row.id);
      }
      if (row.hold_until <= now() && !['confirmed','manual_review','refunded'].includes(row.status)) {
        expireHolds();
        throw httpError(409, 'HOLD_EXPIRED', 'Your reservation expired. Please choose a time and begin again.');
      }
      res.status(201).json({ ...publicBooking(row), accessToken: data.accessToken, keyId: config.razorpayKeyId });
    } catch (e) { next(e); }
  });
  app.get('/api/bookings/:id', async (req, res, next) => {
    try {
      expireHolds();
      let row = authorizeBooking(req);
      if (row.payment_id && ['payment_pending','awaiting_payment','expired'].includes(row.status)) row = await applyPayment(row, row.payment_id);
      res.json({ ...publicBooking(row), keyId: config.razorpayKeyId });
    } catch (e) { next(e); }
  });
  app.post('/api/bookings/:id/verify', async (req, res, next) => {
    try {
      requirePayments(); expireHolds();
      const row = authorizeBooking(req);
      const data = parse(verifySchema, req.body);
      if (data.razorpay_order_id !== row.order_id) throw httpError(400, 'ORDER_MISMATCH', 'The payment order does not match this booking.');
      const expected = createHmac('sha256', config.razorpayKeySecret).update(`${row.order_id}|${data.razorpay_payment_id}`).digest('hex');
      if (!safeEqual(expected, data.razorpay_signature)) throw httpError(400, 'INVALID_SIGNATURE', 'Payment signature verification failed.');
      res.json(publicBooking(await applyPayment(row, data.razorpay_payment_id)));
    } catch (e) { next(e); }
  });
  app.post('/api/contact', rateLimit({ windowMs: 3600000, limit: config.nodeEnv === 'test' ? 1000 : 6, standardHeaders: 'draft-8', legacyHeaders: false }), (req, res) => {
    const data = parse(contactSchema, req.body);
    db.prepare('INSERT INTO contacts(id,name,contact,topic,message,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(), data.name, data.contact, data.topic, data.message, now());
    res.status(201).json({ received: true });
  });

  function session(req) {
    if (!adminEnabled) return null;
    const cookies = Object.fromEntries((req.get('cookie') || '').split(';').map(p => p.trim().split('=')));
    const value = cookies[cookieName];
    if (!value || !/^[a-f0-9]{64}$/.test(value)) return null;
    return db.prepare('SELECT * FROM admin_sessions WHERE token_hash=? AND expires_at>?').get(hash(value), now()) || null;
  }
  function requireAdmin(req, res, next) {
    const s = session(req);
    if (!s) return next(httpError(401, 'UNAUTHORIZED', 'Administrator sign-in required.'));
    req.adminSession = s;
    if (!['GET','HEAD'].includes(req.method) && !safeEqual(req.get('X-CSRF-Token') || '', s.csrf_token)) return next(httpError(403, 'INVALID_CSRF', 'Refresh your administrator session and try again.'));
    next();
  }
  app.get('/api/admin/session', (req, res) => { const s = session(req); res.json(s ? { authenticated: true, csrfToken: s.csrf_token } : { authenticated: false }); });
  app.post('/api/admin/login', rateLimit({ windowMs: 15 * 60000, limit: config.nodeEnv === 'test' ? 1000 : 10, standardHeaders: 'draft-8', legacyHeaders: false }), (req, res) => {
    if (!validPasswordHash(config.adminPasswordHash)) throw httpError(503, 'ADMIN_UNAVAILABLE', 'Administrator access has not been configured.');
    const { password } = parse(z.object({ password: z.string().min(1).max(256) }).strict(), req.body);
    if (!checkPassword(password, config.adminPasswordHash)) throw httpError(401, 'UNAUTHORIZED', 'Unable to sign in.');
    const value = token(), csrfToken = token();
    db.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').run(now());
    db.prepare('INSERT INTO admin_sessions(token_hash,csrf_token,expires_at) VALUES(?,?,?)').run(hash(value), csrfToken, now() + SESSION_MS);
    res.cookie(cookieName, value, { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'strict', path: '/', maxAge: SESSION_MS });
    res.json({ authenticated: true, csrfToken });
  });
  app.post('/api/admin/logout', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM admin_sessions WHERE token_hash=?').run(req.adminSession.token_hash);
    res.clearCookie(cookieName, { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'strict', path: '/' }); res.json({ ok: true });
  });
  app.get('/api/admin/bookings', requireAdmin, (_req, res) => {
    expireHolds();
    const rows = db.prepare('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 500').all();
    res.json({ bookings: rows.map(r => ({ ...publicBooking(r), serviceId: r.service_id, name: r.name, phone: r.phone, email: r.email, birthDate: r.birth_date, birthTime: r.birth_time, birthPlace: r.birth_place, address: r.address, notes: r.notes, createdAt: new Date(r.created_at).toISOString(), paymentId: r.payment_id,
      paymentAttempts: db.prepare('SELECT payment_id AS paymentId,status,amount_refunded AS amountRefunded FROM payment_attempts WHERE booking_id=?').all(r.id) })) });
  });
  app.get('/api/admin/contacts', requireAdmin, (_req, res) => res.json({ contacts: db.prepare('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 500').all().map(r => ({ id: r.id, name: r.name, contact: r.contact, topic: r.topic, message: r.message, createdAt: new Date(r.created_at).toISOString() })) }));
  app.get('/api/admin/closures', requireAdmin, (_req, res) => res.json({ closures: db.prepare('SELECT * FROM closures ORDER BY date,time').all() }));
  app.post('/api/admin/closures', requireAdmin, (req, res) => {
    const data = parse(z.object({ date: dateField, time: z.enum(SLOT_TIMES).optional() }).strict(), req.body);
    const existing = db.prepare('SELECT id FROM closures WHERE date=? AND time IS ?').get(data.date, data.time || null);
    const id = existing?.id || randomUUID();
    if (!existing) db.prepare('INSERT INTO closures(id,date,time) VALUES(?,?,?)').run(id, data.date, data.time || null);
    res.status(201).json({ id, ...data });
  });
  app.delete('/api/admin/closures/:id', requireAdmin, (req, res) => { db.prepare('DELETE FROM closures WHERE id=?').run(req.params.id); res.json({ ok: true }); });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.', code: 'NOT_FOUND' }));
  app.use(express.static(PUBLIC, { dotfiles: 'deny', index: false, maxAge: 3600000, setHeaders: (res, path) => { if (path.endsWith('.html')) res.set('Cache-Control', 'no-cache'); } }));
  app.get('/robots.txt', (_req, res) => res.type('text/plain').send(robotsText(config)));
  app.get('/sitemap.xml', (_req, res) => {
    const sitemap = sitemapXml(config);
    if (!sitemap) return res.status(404).set('X-Robots-Tag', 'noindex').type('text/plain').send('Sitemap available after a public production origin is configured.');
    return res.type('application/xml').send(sitemap);
  });
  app.get('/admin', (_req, res) => res.set({ 'Cache-Control': 'no-cache', 'X-Robots-Tag': 'noindex, nofollow' }).sendFile(join(PUBLIC, 'admin.html')));
  app.get(['/', '/booking', '/birth-chart', '/contact', '/faq', '/privacy', '/terms', '/disclaimer', '/about', '/services', '/services/:slug'], async (req, res) => {
    const page = renderPublicPage(await readFile(join(PUBLIC, 'index.html'), 'utf8'), config, req.path.replace(/\/$/, '') || '/');
    res.status(page.status).set({ 'Cache-Control': 'no-cache', 'X-Robots-Tag': page.robots }).type('html').send(page.html);
  });
  app.use((_req, res) => res.status(404).type('text').send('Page not found.'));
  app.use((error, _req, res, _next) => {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : error.type === 'entity.too.large' ? 413 : 500;
    // Never return provider responses, credentials, SQL, submitted details, or stack traces.
    res.status(status).json({ error: status === 500 ? 'Something went wrong. Please try again or contact us.' : error.type === 'entity.parse.failed' ? 'Invalid JSON.' : error.message, code: error.code && typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'REQUEST_FAILED' });
  });
  return { app, db, close: () => db.close() };
}
