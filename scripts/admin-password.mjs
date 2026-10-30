import { randomBytes, scryptSync } from 'node:crypto';
import { emitKeypressEvents } from 'node:readline';

async function readPassword() {
  if (!process.stdin.isTTY) {
    let value = '';
    for await (const chunk of process.stdin) {
      value += chunk;
      if (value.length > 512) throw new Error('Password input is too long.');
    }
    return value.replace(/\r?\n$/, '');
  }
  process.stderr.write('New admin passphrase (at least 16 characters; input hidden): ');
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return await new Promise((resolve, reject) => {
    let value = '';
    const done = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off('keypress', handler);
      process.stderr.write('\n');
    };
    const handler = (text, key = {}) => {
      if (key.ctrl && key.name === 'c') { done(); reject(new Error('Cancelled.')); }
      else if (key.name === 'return') { done(); resolve(value); }
      else if (key.name === 'backspace') value = Array.from(value).slice(0, -1).join('');
      else if (text && !key.ctrl && !key.meta && value.length < 256) value += text;
    };
    process.stdin.on('keypress', handler);
  });
}

try {
  const password = await readPassword();
  if (password.length < 16 || password.length > 128) throw new Error('Use a unique passphrase of 16–128 characters.');
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
  console.log(`scrypt$${salt}$${hash}`);
  process.stderr.write('Store this hash as ADMIN_PASSWORD_HASH in the server secret settings. Do not commit it.\n');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
