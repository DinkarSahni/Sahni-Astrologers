import { resolve } from 'node:path';
import { validPasswordHash } from './security.js';

export function assertLiveConfiguration(config) {
  if (!(config.razorpayKeyId || '').startsWith('rzp_live_')) return;
  if (config.nodeEnv !== 'production' || !config.siteUrl.startsWith('https://')) throw new Error('Live Razorpay keys require NODE_ENV=production and an HTTPS SITE_URL.');
  if (!validPasswordHash(config.adminPasswordHash)) throw new Error('Configure a strong ADMIN_PASSWORD_HASH before accepting live payments.');
}

export function readConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port.');
  const siteUrl = env.SITE_URL || `http://localhost:${port}`;
  const u = new URL(siteUrl);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw new Error('SITE_URL must be an HTTP(S) origin without a path.');
  if (nodeEnv === 'production' && u.protocol !== 'https:') throw new Error('Production SITE_URL must use HTTPS.');
  const trustProxy = Number(env.TRUST_PROXY || 0);
  if (![0, 1].includes(trustProxy)) throw new Error('TRUST_PROXY must be 0 or 1; only trust a known reverse proxy.');
  const config = {
    nodeEnv, port, siteUrl: u.origin, trustProxy,
    dataDir: resolve(env.DATA_DIR || '.data'),
    razorpayKeyId: env.RAZORPAY_KEY_ID || '',
    razorpayKeySecret: env.RAZORPAY_KEY_SECRET || '',
    razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET || '',
    adminPasswordHash: env.ADMIN_PASSWORD_HASH || '',
  };
  if (config.razorpayKeyId && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(config.razorpayKeyId)) throw new Error('RAZORPAY_KEY_ID is not a test/live key ID.');
  if (config.razorpayKeyId.includes('XXXX')) throw new Error('Replace the placeholder Razorpay key ID in secure settings.');
  assertLiveConfiguration(config);
  return config;
}
export function paymentConfiguration(config) {
  const validId = /^rzp_(test|live)_[A-Za-z0-9]+$/.test(config.razorpayKeyId || '') && !config.razorpayKeyId.includes('XXXX');
  return { enabled: validId && Boolean(config.razorpayKeySecret) && Boolean(config.razorpayWebhookSecret), mode: validId ? (config.razorpayKeyId.startsWith('rzp_live_') ? 'live' : 'test') : null };
}
