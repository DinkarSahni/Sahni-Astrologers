import { DatabaseSync, backup } from 'node:sqlite';
import { resolve, dirname, relative } from 'node:path';
import { access, mkdir, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(process.env.DATA_DIR || resolve(root, '.data'), 'sahni.sqlite');
const destination = process.argv[2] && resolve(process.argv[2]);
if (!destination) {
  console.error('Usage: node --env-file-if-exists=.env scripts/backup.mjs /private-backups/sahni-YYYY-MM-DD.sqlite');
  process.exit(1);
}
const publicRelative = relative(resolve(root, 'public'), destination);
if ((!publicRelative.startsWith('..') && !publicRelative.startsWith('/')) || source === destination) {
  throw new Error('Choose a new backup path outside the public directory and different from the source.');
}
await access(source);
try { await access(destination); throw new Error('Backup destination already exists; choose a new filename.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
process.umask(0o077);
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, destination);
  await chmod(destination, 0o600);
} finally { db.close(); }
const check = new DatabaseSync(destination, { readOnly: true });
try {
  if (check.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Backup integrity check failed.');
} finally { check.close(); }
console.log('Consistent SQLite backup created and checked. Treat the backup as private customer data.');
