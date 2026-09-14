/**
 * Gozargah — user model, CRUD, cache and REAL byte accounting.
 *
 * Traffic accounting: every proxied chunk length is counted (up/down) per user,
 * accumulated in-isolate and coalesced into D1 (ZEUS-style write coalescing) —
 * unlike nahan whose "GB" is actually connections/6000.
 */

import { DEFAULTS } from '../config';
import { ensureSchema, invalidateCache } from './store';
import { sha224Hex } from '../utils/sha224';

export interface GzUser {
  id: number;
  name: string;
  uuid: string;
  trojanPass: string;
  quotaBytes: number; // 0 = unlimited
  usedUp: number;
  usedDown: number;
  expiryAt: number; // epoch ms, 0 = never
  enabled: boolean;
  isAdmin: boolean;
  createdAt: number;
  lastSeen: number;
}

interface UserRow {
  id: number; name: string; uuid: string; trojan_pass: string;
  quota_bytes: number; used_up: number; used_down: number;
  expiry_at: number; enabled: number; is_admin: number;
  created_at: number; last_seen: number;
}

function toUser(r: UserRow): GzUser {
  return {
    id: r.id, name: r.name, uuid: r.uuid, trojanPass: r.trojan_pass,
    quotaBytes: r.quota_bytes, usedUp: r.used_up, usedDown: r.used_down,
    expiryAt: r.expiry_at, enabled: r.enabled === 1, isAdmin: r.is_admin === 1,
    createdAt: r.created_at, lastSeen: r.last_seen,
  };
}

/* ------------------------------ cache ------------------------------ */

let listCache: { at: number; promise: Promise<GzUser[]> } | null = null;

export function invalidateUsers(): void {
  listCache = null;
}

export function listUsers(db: D1Database): Promise<GzUser[]> {
  if (listCache && Date.now() - listCache.at < DEFAULTS.cacheTtlMs) return listCache.promise;
  const p = (async () => {
    await ensureSchema(db);
    const res = await db.prepare('SELECT * FROM users ORDER BY is_admin DESC, id ASC').all<UserRow>();
    return (res.results ?? []).map(toUser);
  })();
  listCache = { at: Date.now(), promise: p };
  p.catch(() => { listCache = null; });
  return p;
}

export async function getUserByUuid(db: D1Database, uuid: string): Promise<GzUser | null> {
  const users = await listUsers(db);
  return users.find((u) => u.uuid === uuid) ?? null;
}

export async function getAdminUser(db: D1Database): Promise<GzUser | null> {
  await ensureSchema(db);
  const row = await db.prepare('SELECT * FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1').first<UserRow>();
  return row ? toUser(row) : null;
}

/** Trojan clients send sha224(password) on the wire — match against users. */
export async function findUserByTrojanHash(db: D1Database, hashHex: string): Promise<GzUser | null> {
  const users = await listUsers(db);
  for (const u of users) {
    if ((await sha224Hex(u.trojanPass)) === hashHex) return u;
  }
  return null;
}

export function isUserAllowed(u: GzUser, now = Date.now()): { ok: boolean; reason: string } {
  if (!u.enabled) return { ok: false, reason: 'disabled' };
  if (u.expiryAt && now > u.expiryAt) return { ok: false, reason: 'expired' };
  if (u.quotaBytes && u.usedUp + u.usedDown >= u.quotaBytes) return { ok: false, reason: 'quota' };
  return { ok: true, reason: '' };
}

/* ------------------------------ CRUD ------------------------------ */

export interface NewUser { name: string; quotaBytes: number; expiryAt: number; isAdmin?: boolean; uuid?: string; trojanPass?: string; }

export async function createUser(db: D1Database, data: NewUser): Promise<GzUser> {
  await ensureSchema(db);
  const now = Date.now();
  const uuid = data.uuid ?? crypto.randomUUID();
  const trojanPass = data.trojanPass ?? randomPass();
  const res = await db
    .prepare(
      'INSERT INTO users (name, uuid, trojan_pass, quota_bytes, expiry_at, enabled, is_admin, created_at) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?7)',
    )
    .bind(
      data.name,
      uuid,
      trojanPass,
      Math.max(0, Math.floor(data.quotaBytes)),
      Math.max(0, Math.floor(data.expiryAt)),
      data.isAdmin ? 1 : 0,
      now,
    )
    .run();
  invalidateUsers();
  const id = res.meta.last_row_id as number;
  return {
    id, name: data.name, uuid, trojanPass,
    quotaBytes: data.quotaBytes, usedUp: 0, usedDown: 0, expiryAt: data.expiryAt,
    enabled: true, isAdmin: !!data.isAdmin, createdAt: now, lastSeen: 0,
  };
}

export interface UserPatch {
  name?: string; quotaBytes?: number; expiryAt?: number; enabled?: boolean;
  usedUp?: number; usedDown?: number; uuid?: string; trojanPass?: string;
}

export async function updateUser(db: D1Database, id: number, patch: UserPatch): Promise<void> {
  await ensureSchema(db);
  const sets: string[] = [];
  const vals: Array<string | number> = [];
  if (patch.name !== undefined) { sets.push('name = ?' + (sets.length + 1)); vals.push(patch.name); }
  if (patch.quotaBytes !== undefined) { sets.push('quota_bytes = ?' + (sets.length + 1)); vals.push(Math.max(0, Math.floor(patch.quotaBytes))); }
  if (patch.expiryAt !== undefined) { sets.push('expiry_at = ?' + (sets.length + 1)); vals.push(Math.max(0, Math.floor(patch.expiryAt))); }
  if (patch.enabled !== undefined) { sets.push('enabled = ?' + (sets.length + 1)); vals.push(patch.enabled ? 1 : 0); }
  if (patch.usedUp !== undefined) { sets.push('used_up = ?' + (sets.length + 1)); vals.push(Math.max(0, Math.floor(patch.usedUp))); }
  if (patch.usedDown !== undefined) { sets.push('used_down = ?' + (sets.length + 1)); vals.push(Math.max(0, Math.floor(patch.usedDown))); }
  if (patch.uuid !== undefined) { sets.push('uuid = ?' + (sets.length + 1)); vals.push(patch.uuid); }
  if (patch.trojanPass !== undefined) { sets.push('trojan_pass = ?' + (sets.length + 1)); vals.push(patch.trojanPass); }
  if (!sets.length) return;
  vals.push(id);
  await db.prepare('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ?' + (sets.length + 1)).bind(...vals).run();
  invalidateUsers();
}

export async function deleteUser(db: D1Database, id: number): Promise<void> {
  await ensureSchema(db);
  await db.prepare('DELETE FROM users WHERE id = ?1 AND is_admin = 0').bind(id).run();
  invalidateUsers();
}

function randomPass(): string {
  const b = crypto.getRandomValues(new Uint8Array(12));
  let s = '';
  for (const v of b) s += v.toString(16).padStart(2, '0');
  return s;
}

/* ------------------------------ usage coalescing ------------------------------ */

const pendingUsage = new Map<number, { up: number; down: number; lastSeen: number }>();
let lastFlush = Date.now();

export function queueUsage(userId: number, up: number, down: number): void {
  const cur = pendingUsage.get(userId) ?? { up: 0, down: 0, lastSeen: 0 };
  cur.up += up;
  cur.down += down;
  cur.lastSeen = Date.now();
  pendingUsage.set(userId, cur);
}

function pendingTotals(): { bytes: number; users: number } {
  let bytes = 0;
  for (const v of pendingUsage.values()) bytes += v.up + v.down;
  return { bytes, users: pendingUsage.size };
}

/** Flush coalesced counters to D1 when thresholds are crossed (called at WS close). */
export async function maybeFlushUsage(db: D1Database): Promise<void> {
  const t = pendingTotals();
  const due = t.users > 0 && (
    t.bytes >= DEFAULTS.usageFlushBytes ||
    t.users >= DEFAULTS.usageFlushUsers ||
    Date.now() - lastFlush >= DEFAULTS.usageFlushIntervalMs
  );
  if (!due) return;
  await flushUsage(db);
}

export async function flushUsage(db: D1Database): Promise<void> {
  if (pendingUsage.size === 0) return;
  const batch: D1PreparedStatement[] = [];
  const now = Date.now();
  for (const [id, v] of pendingUsage) {
    batch.push(
      db.prepare(
        'UPDATE users SET used_up = used_up + ?1, used_down = used_down + ?2, last_seen = ?3 WHERE id = ?4',
      ).bind(v.up, v.down, now, id),
    );
  }
  pendingUsage.clear();
  lastFlush = now;
  try {
    await db.batch(batch);
    invalidateUsers();
  } catch {
    /* counters stay in memory; next flush retries */
  }
}
