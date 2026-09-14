/**
 * Gozargah — D1 storage layer.
 *
 * Design decisions (borrowed from the 5-panel benchmark study):
 *  - relational tables (users / events / auth_throttle) instead of one JSON blob
 *  - settings kept as a versioned JSON row with OPTIMISTIC locking (rev counter)
 *    -> fixes the JSON-blob write race found in nahan/BPB
 *  - schema auto-created on first use, memoized per isolate with promise dedup
 *  - every read cached for DEFAULTS.cacheTtlMs with in-flight promise dedup
 */

import { DEFAULTS, SCHEMA_VERSION } from '../config';

export interface SettingsBlob {
  schemaVersion: number;
  panelPath: string;
  subPath: string;
  proxyIPs: string[];
  passwordSalt: string;
  passwordHash: string;
  pwIterations: number;
  isDefaultPassword: boolean;
  createdAt: number;
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS kv_store (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL,
     rev INTEGER NOT NULL DEFAULT 0,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     uuid TEXT NOT NULL UNIQUE,
     trojan_pass TEXT NOT NULL,
     quota_bytes INTEGER NOT NULL DEFAULT 0,
     used_up INTEGER NOT NULL DEFAULT 0,
     used_down INTEGER NOT NULL DEFAULT 0,
     expiry_at INTEGER NOT NULL DEFAULT 0,
     enabled INTEGER NOT NULL DEFAULT 1,
     is_admin INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL,
     last_seen INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS events (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     ts INTEGER NOT NULL,
     type TEXT NOT NULL,
     detail TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS auth_throttle (
     ip_hash TEXT PRIMARY KEY,
     count INTEGER NOT NULL,
     window_start INTEGER NOT NULL
   )`,
];

let schemaPromise: Promise<void> | null = null;

/** Create tables once per isolate (promise-deduped). */
export function ensureSchema(db: D1Database): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.batch(DDL.map((sql) => db.prepare(sql)));
    })().catch((e) => {
      schemaPromise = null; // allow retry on next request
      throw e;
    });
  }
  return schemaPromise;
}

/* ------------------------------ settings ------------------------------ */

interface CacheEntry { at: number; value: unknown; }
const cache = new Map<string, CacheEntry>();

function cached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DEFAULTS.cacheTtlMs) return hit.value as T;
  return null;
}
function putCache(key: string, value: unknown): void {
  cache.set(key, { at: Date.now(), value });
}
export function invalidateCache(prefix?: string): void {
  if (!prefix) { cache.clear(); return; }
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}

const SETTINGS_KEY = 'settings';

export async function loadSettings(db: D1Database): Promise<SettingsBlob | null> {
  const hit = cached<SettingsBlob>(SETTINGS_KEY);
  if (hit) return hit;
  await ensureSchema(db);
  const row = await db
    .prepare('SELECT value, rev FROM kv_store WHERE key = ?1')
    .bind(SETTINGS_KEY)
    .first<{ value: string; rev: number }>();
  if (!row) return null;
  const value = JSON.parse(row.value) as SettingsBlob;
  putCache(SETTINGS_KEY + '#rev', row.rev);
  putCache(SETTINGS_KEY, value);
  return value;
}

/** Read-modify-write with optimistic rev check (3 retries). */
export async function saveSettings(
  db: D1Database,
  mutate: (prev: SettingsBlob | null) => SettingsBlob,
): Promise<SettingsBlob> {
  await ensureSchema(db);
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await db
      .prepare('SELECT value, rev FROM kv_store WHERE key = ?1')
      .bind(SETTINGS_KEY)
      .first<{ value: string; rev: number }>();
    const prev = row ? (JSON.parse(row.value) as SettingsBlob) : null;
    const rev = row ? row.rev : 0;
    const next = mutate(prev);
    next.schemaVersion = SCHEMA_VERSION;
    const encoded = JSON.stringify(next);
    const res = row
      ? await db
          .prepare('UPDATE kv_store SET value = ?1, rev = rev + 1, updated_at = ?2 WHERE key = ?3 AND rev = ?4')
          .bind(encoded, Date.now(), SETTINGS_KEY, rev)
          .run()
      : await db
          .prepare('INSERT INTO kv_store (key, value, rev, updated_at) VALUES (?1, ?2, 1, ?3)')
          .bind(SETTINGS_KEY, encoded, Date.now())
          .run();
    if (res.meta.changes === 1 || !row) {
      invalidateCache(SETTINGS_KEY);
      return next;
    }
  }
  throw new Error('settings concurrent write conflict — retry');
}

/* ------------------------------ events ------------------------------ */

export async function addEvent(db: D1Database, type: string, detail: string): Promise<void> {
  try {
    await ensureSchema(db);
    await db.prepare('INSERT INTO events (ts, type, detail) VALUES (?1, ?2, ?3)').bind(Date.now(), type, detail).run();
    // keep the ring small
    await db.prepare(
      'DELETE FROM events WHERE id <= (SELECT id FROM events ORDER BY id DESC LIMIT 1 OFFSET 49)',
    ).run();
  } catch {
    /* logging must never break requests */
  }
}

export async function recentEvents(db: D1Database, limit = 10): Promise<Array<{ ts: number; type: string; detail: string }>> {
  await ensureSchema(db);
  const res = await db
    .prepare('SELECT ts, type, detail FROM events ORDER BY id DESC LIMIT ?1')
    .bind(limit)
    .all<{ ts: number; type: string; detail: string }>();
  return res.results ?? [];
}

/* ------------------------------ login throttle ------------------------------ */

export async function loginAttemptsLeft(db: D1Database, ipHash: string): Promise<number> {
  await ensureSchema(db);
  const row = await db.prepare('SELECT count, window_start FROM auth_throttle WHERE ip_hash = ?1').bind(ipHash).first<{ count: number; window_start: number }>();
  if (!row || Date.now() - row.window_start > DEFAULTS.loginWindowMs) return DEFAULTS.loginMaxAttempts;
  return Math.max(0, DEFAULTS.loginMaxAttempts - row.count);
}

export async function recordLoginFailure(db: D1Database, ipHash: string): Promise<void> {
  await ensureSchema(db);
  const now = Date.now();
  const row = await db.prepare('SELECT count, window_start FROM auth_throttle WHERE ip_hash = ?1').bind(ipHash).first<{ count: number; window_start: number }>();
  if (!row || now - row.window_start > DEFAULTS.loginWindowMs) {
    await db.prepare(
      'INSERT INTO auth_throttle (ip_hash, count, window_start) VALUES (?1, 1, ?2) ' +
      'ON CONFLICT(ip_hash) DO UPDATE SET count = 1, window_start = ?2',
    ).bind(ipHash, now).run();
  } else {
    await db.prepare('UPDATE auth_throttle SET count = count + 1 WHERE ip_hash = ?1').bind(ipHash).run();
  }
}

export async function clearLoginThrottle(db: D1Database, ipHash: string): Promise<void> {
  await ensureSchema(db);
  await db.prepare('DELETE FROM auth_throttle WHERE ip_hash = ?1').bind(ipHash).run();
}
