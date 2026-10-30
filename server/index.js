import { readConfig, paymentConfiguration } from './config.js';
import { validPasswordHash } from './security.js';
import { createApp } from './app.js';

process.umask(0o077);
const config = readConfig();
const { app, close } = createApp(config);
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Sahni Astrologers listening on port ${config.port}.`);
  console.log(`Payments: ${paymentConfiguration(config).enabled ? paymentConfiguration(config).mode : 'disabled (configuration required)'}.`);
  console.log(`Administrator access: ${validPasswordHash(config.adminPasswordHash) ? 'configured' : 'disabled (configuration required)'}.`);
});
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => {
  server.close(() => { close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
});
