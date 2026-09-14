/**
 * Gozargah — effective settings resolution + first-boot bootstrap.
 *
 * Precedence: D1 settings row  ->  deterministic per-host defaults.
 * Without D1 the worker still proxies (stable UUID/trojan derived from the
 * hostname) and the panel shows a setup guide instead of lying about persistence.
 * With D1, first boot bootstraps: settings row (default password "admin") + admin user.
 */

import { DEFAULTS, Env } from './config';
import { loadSettings, SettingsBlob, ensureSchema } from './db/store';
import { getAdminUser } from './db/users';
import { pbkdf2Hex, sha256Hex, uuidFromSeed } from './utils/crypto';

export interface EffectiveSettings extends SettingsBlob {
  dbOk: boolean;
  /** default (admin) user credentials — used by envless mode and the dashboard */
  uuid: string;
  trojanPass: string;
}

/** Cache computed envless password hash per isolate (PBKDF2 is expensive). */
let envlessPwCache: { salt: string; hash: string } | null = null;

export async function getEffectiveSettings(env: Env, host: string): Promise<EffectiveSettings> {
  if (env.GZ_DB) {
    try {
      const db = env.GZ_DB;
      await ensureSchema(db);
      let s = await loadSettings(db);
      if (!s) {
        await bootstrapSettings(env, host);
        s = await loadSettings(db);
      }
      if (s) {
        const admin = await getAdminUser(db);
        const uuid = admin ? admin.uuid : await uuidFromSeed(host + ':admin');
        const trojanPass = admin ? admin.trojanPass : (await sha256Hex(host + ':trojan')).slice(0, 16);
        return { ...s, dbOk: true, uuid, trojanPass };
      }
    } catch {
      /* fall through to envless mode */
    }
  }
  return envlessSettings(host);
}

export async function envlessSettings(host: string): Promise<EffectiveSettings> {
  const uuid = await uuidFromSeed(host + ':admin');
  const trojanPass = (await sha256Hex(host + ':trojan')).slice(0, 16);
  let salt: string, hash: string;
  if (envlessPwCache) {
    salt = envlessPwCache.salt;
    hash = envlessPwCache.hash;
  } else {
    salt = (await sha256Hex('gz-envless-salt:' + host)).slice(0, 32);
    hash = await pbkdf2Hex(DEFAULTS.defaultPassword, salt, 2048); // light iterations in envless mode
    envlessPwCache = { salt, hash };
  }
  return {
    schemaVersion: 1,
    panelPath: DEFAULTS.panelPath,
    subPath: DEFAULTS.subPath,
    proxyIPs: [...DEFAULTS.proxyIPs],
    passwordSalt: salt,
    passwordHash: hash,
    pwIterations: 2048,
    isDefaultPassword: true,
    createdAt: 0,
    dbOk: false,
    uuid,
    trojanPass,
  };
}

/**
 * First boot with D1: create the settings row (default password) and the
 * admin user row with deterministic per-host credentials.
 */
export async function bootstrapSettings(env: Env, host: string): Promise<void> {
  if (!env.GZ_DB) return;
  const db = env.GZ_DB;
  await ensureSchema(db);

  const existing = await loadSettings(db);
  if (existing) return;

  const saltHex = randomHex(16);
  const hash = await pbkdf2Hex(DEFAULTS.defaultPassword, saltHex, DEFAULTS.pwIterations);
  const blob: SettingsBlob = {
    schemaVersion: 1,
    panelPath: DEFAULTS.panelPath,
    subPath: DEFAULTS.subPath,
    proxyIPs: [...DEFAULTS.proxyIPs],
    passwordSalt: saltHex,
    passwordHash: hash,
    pwIterations: DEFAULTS.pwIterations,
    isDefaultPassword: true,
    createdAt: Date.now(),
  };
  await db
    .prepare('INSERT OR IGNORE INTO kv_store (key, value, rev, updated_at) VALUES (?1, ?2, 1, ?3)')
    .bind('settings', JSON.stringify(blob), Date.now())
    .run();

  const uuid = await uuidFromSeed(host + ':admin');
  const trojanPass = (await sha256Hex(host + ':trojan')).slice(0, 16);
  await db
    .prepare(
      'INSERT OR IGNORE INTO users (name, uuid, trojan_pass, quota_bytes, expiry_at, enabled, is_admin, created_at) ' +
      'VALUES (?1, ?2, ?3, 0, 0, 1, 1, ?4)',
    )
    .bind('admin', uuid, trojanPass, Date.now())
    .run();
}

function randomHex(byteLen: number): string {
  const b = crypto.getRandomValues(new Uint8Array(byteLen));
  let s = '';
  for (const v of b) s += v.toString(16).padStart(2, '0');
  return s;
}
