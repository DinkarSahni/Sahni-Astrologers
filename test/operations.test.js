import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { checkPassword } from '../server/security.js';

test('admin password helper creates a hash accepted by the real login verifier, never prints the password', () => {
  const password = 'a unique passphrase for the test only';
  const result = spawnSync(process.execPath, ['scripts/admin-password.mjs'], { input: password + '\n', encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.includes(password), false);
  assert.equal(checkPassword(password, result.stdout.trim()), true);
  assert.equal(checkPassword('wrong passphrase', result.stdout.trim()), false);
  const invalid = spawnSync(process.execPath, ['scripts/admin-password.mjs'], { input: 'short\n', encoding: 'utf8' });
  assert.notEqual(invalid.status, 0);
  assert.equal(invalid.stdout, '');
});

test('online backup includes committed WAL data, verifies integrity, and will not overwrite a backup', t => {
  const dir = mkdtempSync(join(tmpdir(), 'sahni-backup-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const db = new DatabaseSync(join(dir, 'sahni.sqlite'));
  t.after(() => db.close());
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE sample (reference TEXT); INSERT INTO sample VALUES ('confirmed-booking-test');");
  const destination = join(dir, 'private-backup.sqlite');
  const env = { ...process.env, DATA_DIR: dir };
  const result = spawnSync(process.execPath, ['scripts/backup.mjs', destination], { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(statSync(destination).mode & 0o777, 0o600);
  const copy = new DatabaseSync(destination, { readOnly: true });
  try { assert.equal(copy.prepare('SELECT reference FROM sample').get().reference, 'confirmed-booking-test'); }
  finally { copy.close(); }
  const overwrite = spawnSync(process.execPath, ['scripts/backup.mjs', destination], { env, encoding: 'utf8' });
  assert.notEqual(overwrite.status, 0);
  const publicPath = resolve('public', 'private-backup.sqlite');
  const exposed = spawnSync(process.execPath, ['scripts/backup.mjs', publicPath], { env, encoding: 'utf8' });
  assert.notEqual(exposed.status, 0);
});
