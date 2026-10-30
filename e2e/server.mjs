// Test-only gateway adapter. This file is never copied into the production image.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { makePasswordHash } from '../server/security.js';

const dataDir = mkdtempSync(join(tmpdir(), 'sahni-browser-test-'));
const orders = new Map();
const paymentProvider = {
  async createOrder(input) {
    const order = { ...input, id: `order_browser${orders.size + 1}` };
    orders.set(order.id, order);
    return order;
  },
  async getPayment(id) {
    const order = orders.get(id.replace('pay_', 'order_'));
    if (!order) throw new Error('Unknown test payment.');
    return { id, order_id: order.id, amount: order.amount, currency: 'INR', status: 'captured', captured: true, amount_refunded: 0 };
  },
};
const instance = createApp({
  dataDir, port: 4173, siteUrl: 'http://localhost:4173', nodeEnv: 'test', trustProxy: 0,
  razorpayKeyId: 'rzp_test_browser', razorpayKeySecret: 'browser-test-only-secret',
  razorpayWebhookSecret: 'browser-test-only-webhook',
  adminPasswordHash: makePasswordHash('browser test administrator passphrase'),
}, { paymentProvider });
const server = instance.app.listen(4173, '127.0.0.1');
for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => server.close(() => {
  instance.close(); rmSync(dataDir, { recursive: true, force: true }); process.exit(0);
}));
