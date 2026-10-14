import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, openSync, closeSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
export function openDatabase(path: string) {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    try { const fd = openSync(path, 'wx', 0o600); closeSync(fd); chmodSync(path, 0o600); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  }
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('customer','dealer','admin')),created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS dealers(id TEXT PRIMARY KEY,name TEXT NOT NULL,source_url TEXT NOT NULL,verified_at TEXT NOT NULL,accepted_by TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS memberships(user_id TEXT REFERENCES users(id),dealer_id TEXT REFERENCES dealers(id),PRIMARY KEY(user_id,dealer_id));
CREATE TABLE IF NOT EXISTS vehicles(id TEXT PRIMARY KEY,make TEXT NOT NULL,model TEXT NOT NULL,variant TEXT NOT NULL,fuel TEXT NOT NULL,body_type TEXT NOT NULL,price_paise INTEGER NOT NULL CHECK(price_paise>=0),source_url TEXT NOT NULL,verified_at TEXT NOT NULL,specifications TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS offers(id TEXT PRIMARY KEY,vehicle_id TEXT NOT NULL REFERENCES vehicles(id),dealer_id TEXT NOT NULL REFERENCES dealers(id),price_paise INTEGER NOT NULL CHECK(price_paise>=0),stock INTEGER NOT NULL CHECK(stock>=0),source_url TEXT NOT NULL,verified_at TEXT NOT NULL,expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS garage(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),vehicle_id TEXT NOT NULL REFERENCES vehicles(id),notes TEXT NOT NULL DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,vehicle_id));
CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),offer_id TEXT NOT NULL REFERENCES offers(id),status TEXT NOT NULL CHECK(status IN ('requested','confirmed','cancelled','completed')),price_paise INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS idempotency(user_id TEXT NOT NULL REFERENCES users(id),key TEXT NOT NULL,offer_id TEXT NOT NULL,booking_id TEXT NOT NULL REFERENCES bookings(id),PRIMARY KEY(user_id,key));
CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),subject TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS exchanges(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),registration_year INTEGER NOT NULL,make TEXT NOT NULL,model TEXT NOT NULL,kilometres INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'requested',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),storage_key TEXT NOT NULL,mime_type TEXT NOT NULL,size_bytes INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,actor_id TEXT REFERENCES users(id),action TEXT NOT NULL,entity_id TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS sessions_user_expiry ON sessions(user_id,expires_at);
CREATE INDEX IF NOT EXISTS memberships_dealer_user ON memberships(dealer_id,user_id);
CREATE INDEX IF NOT EXISTS vehicles_filters ON vehicles(fuel,body_type,make,model);
CREATE INDEX IF NOT EXISTS vehicles_names ON vehicles(make,model);
CREATE INDEX IF NOT EXISTS offers_vehicle_availability ON offers(vehicle_id,expires_at,verified_at);
CREATE INDEX IF NOT EXISTS offers_dealer ON offers(dealer_id);
CREATE INDEX IF NOT EXISTS bookings_user_created ON bookings(user_id,created_at);
CREATE INDEX IF NOT EXISTS bookings_offer ON bookings(offer_id);
CREATE INDEX IF NOT EXISTS tickets_user_created ON tickets(user_id,created_at);
CREATE INDEX IF NOT EXISTS exchanges_user_created ON exchanges(user_id,created_at);
CREATE INDEX IF NOT EXISTS documents_user_created ON documents(user_id,created_at);
CREATE INDEX IF NOT EXISTS audit_created ON audit(created_at);
`);
  return db;
}
