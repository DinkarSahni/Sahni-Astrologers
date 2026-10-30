import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

export function openDatabase(dataDir) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const path = join(dataDir, 'sahni.sqlite');
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS environment_meta (name TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY, idempotency_hash TEXT UNIQUE NOT NULL, request_hash TEXT NOT NULL,
      token_hash TEXT NOT NULL, service_id TEXT NOT NULL, service_name TEXT NOT NULL,
      amount INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL,
      name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, birth_date TEXT NOT NULL,
      birth_time TEXT NOT NULL, birth_place TEXT NOT NULL, address TEXT NOT NULL, notes TEXT NOT NULL,
      appointment_date TEXT, appointment_time TEXT, hold_until INTEGER NOT NULL,
      order_id TEXT UNIQUE, payment_id TEXT UNIQUE, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      teva_language TEXT NOT NULL DEFAULT 'en'
    );
    CREATE TABLE IF NOT EXISTS reservations (
      date TEXT NOT NULL, time TEXT NOT NULL, booking_id TEXT UNIQUE NOT NULL REFERENCES bookings(id),
      PRIMARY KEY(date,time)
    );
    CREATE TABLE IF NOT EXISTS webhook_events (id TEXT PRIMARY KEY, received_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS payment_attempts (
      payment_id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id),
      status TEXT NOT NULL, amount_refunded INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL, topic TEXT NOT NULL,
      message TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY, csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS closures (id TEXT PRIMARY KEY, date TEXT NOT NULL, time TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS closures_unique ON closures(date,COALESCE(time,''));
  `);
  transaction(db, () => {
    const columns = db.prepare('PRAGMA table_info(bookings)').all();
    if (!columns.some(column => column.name === 'teva_language')) {
      db.exec("ALTER TABLE bookings ADD COLUMN teva_language TEXT NOT NULL DEFAULT 'en'");
    }
  });
  return db;
}
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const out = fn(); db.exec('COMMIT'); return out; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
