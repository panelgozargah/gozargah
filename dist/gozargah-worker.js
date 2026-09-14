var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/config.ts
var VERSION, SCHEMA_VERSION, GzError, DEFAULTS;
var init_config = __esm({
  "src/config.ts"() {
    "use strict";
    VERSION = "1.0.0";
    SCHEMA_VERSION = 1;
    GzError = class extends Error {
      code;
      constructor(message, code = "gz_error") {
        super(message);
        this.name = "GzError";
        this.code = code;
      }
    };
    __name(GzError, "GzError");
    DEFAULTS = {
      panelPath: "gozargah",
      subPath: "sub",
      /** community round-robin proxyIP endpoint — replace with your own for production */
      proxyIPs: ["proxyip.cmliussss.net"],
      defaultPassword: "admin",
      pwIterations: 1e5,
      sessionTtlMs: 7 * 24 * 3600 * 1e3,
      loginWindowMs: 15 * 60 * 1e3,
      loginMaxAttempts: 5,
      /** settings/users cache TTL inside an isolate */
      cacheTtlMs: 1e4,
      /** flush accumulated per-user byte counters to D1 when above these */
      usageFlushBytes: 512 * 1024,
      usageFlushUsers: 8,
      usageFlushIntervalMs: 3e4
    };
  }
});

// src/db/store.ts
var store_exports = {};
__export(store_exports, {
  addEvent: () => addEvent,
  clearLoginThrottle: () => clearLoginThrottle,
  ensureSchema: () => ensureSchema,
  invalidateCache: () => invalidateCache,
  loadSettings: () => loadSettings,
  loginAttemptsLeft: () => loginAttemptsLeft,
  recentEvents: () => recentEvents,
  recordLoginFailure: () => recordLoginFailure,
  saveSettings: () => saveSettings
});
function ensureSchema(db) {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.batch(DDL.map((sql) => db.prepare(sql)));
    })().catch((e) => {
      schemaPromise = null;
      throw e;
    });
  }
  return schemaPromise;
}
function cached(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DEFAULTS.cacheTtlMs)
    return hit.value;
  return null;
}
function putCache(key, value) {
  cache.set(key, { at: Date.now(), value });
}
function invalidateCache(prefix) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const k of cache.keys())
    if (k.startsWith(prefix))
      cache.delete(k);
}
async function loadSettings(db) {
  const hit = cached(SETTINGS_KEY);
  if (hit)
    return hit;
  await ensureSchema(db);
  const row = await db.prepare("SELECT value, rev FROM kv_store WHERE key = ?1").bind(SETTINGS_KEY).first();
  if (!row)
    return null;
  const value = JSON.parse(row.value);
  putCache(SETTINGS_KEY + "#rev", row.rev);
  putCache(SETTINGS_KEY, value);
  return value;
}
async function saveSettings(db, mutate) {
  await ensureSchema(db);
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await db.prepare("SELECT value, rev FROM kv_store WHERE key = ?1").bind(SETTINGS_KEY).first();
    const prev = row ? JSON.parse(row.value) : null;
    const rev = row ? row.rev : 0;
    const next = mutate(prev);
    next.schemaVersion = SCHEMA_VERSION;
    const encoded = JSON.stringify(next);
    const res = row ? await db.prepare("UPDATE kv_store SET value = ?1, rev = rev + 1, updated_at = ?2 WHERE key = ?3 AND rev = ?4").bind(encoded, Date.now(), SETTINGS_KEY, rev).run() : await db.prepare("INSERT INTO kv_store (key, value, rev, updated_at) VALUES (?1, ?2, 1, ?3)").bind(SETTINGS_KEY, encoded, Date.now()).run();
    if (res.meta.changes === 1 || !row) {
      invalidateCache(SETTINGS_KEY);
      return next;
    }
  }
  throw new Error("settings concurrent write conflict \u2014 retry");
}
async function addEvent(db, type, detail) {
  try {
    await ensureSchema(db);
    await db.prepare("INSERT INTO events (ts, type, detail) VALUES (?1, ?2, ?3)").bind(Date.now(), type, detail).run();
    await db.prepare(
      "DELETE FROM events WHERE id <= (SELECT id FROM events ORDER BY id DESC LIMIT 1 OFFSET 49)"
    ).run();
  } catch {
  }
}
async function recentEvents(db, limit = 10) {
  await ensureSchema(db);
  const res = await db.prepare("SELECT ts, type, detail FROM events ORDER BY id DESC LIMIT ?1").bind(limit).all();
  return res.results ?? [];
}
async function loginAttemptsLeft(db, ipHash3) {
  await ensureSchema(db);
  const row = await db.prepare("SELECT count, window_start FROM auth_throttle WHERE ip_hash = ?1").bind(ipHash3).first();
  if (!row || Date.now() - row.window_start > DEFAULTS.loginWindowMs)
    return DEFAULTS.loginMaxAttempts;
  return Math.max(0, DEFAULTS.loginMaxAttempts - row.count);
}
async function recordLoginFailure(db, ipHash3) {
  await ensureSchema(db);
  const now = Date.now();
  const row = await db.prepare("SELECT count, window_start FROM auth_throttle WHERE ip_hash = ?1").bind(ipHash3).first();
  if (!row || now - row.window_start > DEFAULTS.loginWindowMs) {
    await db.prepare(
      "INSERT INTO auth_throttle (ip_hash, count, window_start) VALUES (?1, 1, ?2) ON CONFLICT(ip_hash) DO UPDATE SET count = 1, window_start = ?2"
    ).bind(ipHash3, now).run();
  } else {
    await db.prepare("UPDATE auth_throttle SET count = count + 1 WHERE ip_hash = ?1").bind(ipHash3).run();
  }
}
async function clearLoginThrottle(db, ipHash3) {
  await ensureSchema(db);
  await db.prepare("DELETE FROM auth_throttle WHERE ip_hash = ?1").bind(ipHash3).run();
}
var DDL, schemaPromise, cache, SETTINGS_KEY;
var init_store = __esm({
  "src/db/store.ts"() {
    "use strict";
    init_config();
    DDL = [
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
   )`
    ];
    schemaPromise = null;
    __name(ensureSchema, "ensureSchema");
    cache = /* @__PURE__ */ new Map();
    __name(cached, "cached");
    __name(putCache, "putCache");
    __name(invalidateCache, "invalidateCache");
    SETTINGS_KEY = "settings";
    __name(loadSettings, "loadSettings");
    __name(saveSettings, "saveSettings");
    __name(addEvent, "addEvent");
    __name(recentEvents, "recentEvents");
    __name(loginAttemptsLeft, "loginAttemptsLeft");
    __name(recordLoginFailure, "recordLoginFailure");
    __name(clearLoginThrottle, "clearLoginThrottle");
  }
});

// src/index.ts
init_config();

// src/settings.ts
init_config();
init_store();

// src/db/users.ts
init_config();
init_store();

// src/utils/sha224.ts
var K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
function rotr(x, n) {
  return (x >>> n | x << 32 - n) >>> 0;
}
__name(rotr, "rotr");
var enc = new TextEncoder();
function sha224Hex(msg) {
  const data = enc.encode(msg);
  const l = data.length;
  const total = Math.ceil((l + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(data);
  buf[l] = 128;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, Math.floor(l / 536870912));
  dv.setUint32(total - 4, l << 3 >>> 0);
  let h0 = 3238371032, h1 = 914150663, h2 = 812702999, h3 = 4144912697, h4 = 4290775857, h5 = 1750603025, h6 = 1694076839, h7 = 3204075428;
  const w = new Uint32Array(64);
  for (let i = 0; i < total; i += 64) {
    for (let j = 0; j < 16; j++)
      w[j] = dv.getUint32(i + j * 4);
    for (let j = 16; j < 64; j++) {
      const a15 = w[j - 15], a2 = w[j - 2];
      const s0 = (rotr(a15, 7) ^ rotr(a15, 18) ^ a15 >>> 3) >>> 0;
      const s1 = (rotr(a2, 17) ^ rotr(a2, 19) ^ a2 >>> 10) >>> 0;
      w[j] = w[j - 16] + s0 + w[j - 7] + s1 >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let j = 0; j < 64; j++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = (e & f ^ ~e & g) >>> 0;
      const t1 = h + S1 + ch + K[j] + w[j] >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = (a & b ^ a & c ^ b & c) >>> 0;
      const t2 = S0 + maj >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    h0 = h0 + a >>> 0;
    h1 = h1 + b >>> 0;
    h2 = h2 + c >>> 0;
    h3 = h3 + d >>> 0;
    h4 = h4 + e >>> 0;
    h5 = h5 + f >>> 0;
    h6 = h6 + g >>> 0;
    h7 = h7 + h >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6].map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
__name(sha224Hex, "sha224Hex");

// src/db/users.ts
function toUser(r) {
  return {
    id: r.id,
    name: r.name,
    uuid: r.uuid,
    trojanPass: r.trojan_pass,
    quotaBytes: r.quota_bytes,
    usedUp: r.used_up,
    usedDown: r.used_down,
    expiryAt: r.expiry_at,
    enabled: r.enabled === 1,
    isAdmin: r.is_admin === 1,
    createdAt: r.created_at,
    lastSeen: r.last_seen
  };
}
__name(toUser, "toUser");
var listCache = null;
function invalidateUsers() {
  listCache = null;
}
__name(invalidateUsers, "invalidateUsers");
function listUsers(db) {
  if (listCache && Date.now() - listCache.at < DEFAULTS.cacheTtlMs)
    return listCache.promise;
  const p = (async () => {
    await ensureSchema(db);
    const res = await db.prepare("SELECT * FROM users ORDER BY is_admin DESC, id ASC").all();
    return (res.results ?? []).map(toUser);
  })();
  listCache = { at: Date.now(), promise: p };
  p.catch(() => {
    listCache = null;
  });
  return p;
}
__name(listUsers, "listUsers");
async function getUserByUuid(db, uuid) {
  const users = await listUsers(db);
  return users.find((u) => u.uuid === uuid) ?? null;
}
__name(getUserByUuid, "getUserByUuid");
async function getAdminUser(db) {
  await ensureSchema(db);
  const row = await db.prepare("SELECT * FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1").first();
  return row ? toUser(row) : null;
}
__name(getAdminUser, "getAdminUser");
async function findUserByTrojanHash(db, hashHex) {
  const users = await listUsers(db);
  for (const u of users) {
    if (await sha224Hex(u.trojanPass) === hashHex)
      return u;
  }
  return null;
}
__name(findUserByTrojanHash, "findUserByTrojanHash");
function isUserAllowed(u, now = Date.now()) {
  if (!u.enabled)
    return { ok: false, reason: "disabled" };
  if (u.expiryAt && now > u.expiryAt)
    return { ok: false, reason: "expired" };
  if (u.quotaBytes && u.usedUp + u.usedDown >= u.quotaBytes)
    return { ok: false, reason: "quota" };
  return { ok: true, reason: "" };
}
__name(isUserAllowed, "isUserAllowed");
async function createUser(db, data) {
  await ensureSchema(db);
  const now = Date.now();
  const uuid = data.uuid ?? crypto.randomUUID();
  const trojanPass = data.trojanPass ?? randomPass();
  const res = await db.prepare(
    "INSERT INTO users (name, uuid, trojan_pass, quota_bytes, expiry_at, enabled, is_admin, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?7)"
  ).bind(
    data.name,
    uuid,
    trojanPass,
    Math.max(0, Math.floor(data.quotaBytes)),
    Math.max(0, Math.floor(data.expiryAt)),
    data.isAdmin ? 1 : 0,
    now
  ).run();
  invalidateUsers();
  const id = res.meta.last_row_id;
  return {
    id,
    name: data.name,
    uuid,
    trojanPass,
    quotaBytes: data.quotaBytes,
    usedUp: 0,
    usedDown: 0,
    expiryAt: data.expiryAt,
    enabled: true,
    isAdmin: !!data.isAdmin,
    createdAt: now,
    lastSeen: 0
  };
}
__name(createUser, "createUser");
async function updateUser(db, id, patch) {
  await ensureSchema(db);
  const sets = [];
  const vals = [];
  if (patch.name !== void 0) {
    sets.push("name = ?" + (sets.length + 1));
    vals.push(patch.name);
  }
  if (patch.quotaBytes !== void 0) {
    sets.push("quota_bytes = ?" + (sets.length + 1));
    vals.push(Math.max(0, Math.floor(patch.quotaBytes)));
  }
  if (patch.expiryAt !== void 0) {
    sets.push("expiry_at = ?" + (sets.length + 1));
    vals.push(Math.max(0, Math.floor(patch.expiryAt)));
  }
  if (patch.enabled !== void 0) {
    sets.push("enabled = ?" + (sets.length + 1));
    vals.push(patch.enabled ? 1 : 0);
  }
  if (patch.usedUp !== void 0) {
    sets.push("used_up = ?" + (sets.length + 1));
    vals.push(Math.max(0, Math.floor(patch.usedUp)));
  }
  if (patch.usedDown !== void 0) {
    sets.push("used_down = ?" + (sets.length + 1));
    vals.push(Math.max(0, Math.floor(patch.usedDown)));
  }
  if (patch.uuid !== void 0) {
    sets.push("uuid = ?" + (sets.length + 1));
    vals.push(patch.uuid);
  }
  if (patch.trojanPass !== void 0) {
    sets.push("trojan_pass = ?" + (sets.length + 1));
    vals.push(patch.trojanPass);
  }
  if (!sets.length)
    return;
  vals.push(id);
  await db.prepare("UPDATE users SET " + sets.join(", ") + " WHERE id = ?" + (sets.length + 1)).bind(...vals).run();
  invalidateUsers();
}
__name(updateUser, "updateUser");
async function deleteUser(db, id) {
  await ensureSchema(db);
  await db.prepare("DELETE FROM users WHERE id = ?1 AND is_admin = 0").bind(id).run();
  invalidateUsers();
}
__name(deleteUser, "deleteUser");
function randomPass() {
  const b = crypto.getRandomValues(new Uint8Array(12));
  let s = "";
  for (const v of b)
    s += v.toString(16).padStart(2, "0");
  return s;
}
__name(randomPass, "randomPass");
var pendingUsage = /* @__PURE__ */ new Map();
var lastFlush = Date.now();
function queueUsage(userId, up, down) {
  const cur = pendingUsage.get(userId) ?? { up: 0, down: 0, lastSeen: 0 };
  cur.up += up;
  cur.down += down;
  cur.lastSeen = Date.now();
  pendingUsage.set(userId, cur);
}
__name(queueUsage, "queueUsage");
function pendingTotals() {
  let bytes = 0;
  for (const v of pendingUsage.values())
    bytes += v.up + v.down;
  return { bytes, users: pendingUsage.size };
}
__name(pendingTotals, "pendingTotals");
async function maybeFlushUsage(db) {
  const t = pendingTotals();
  const due = t.users > 0 && (t.bytes >= DEFAULTS.usageFlushBytes || t.users >= DEFAULTS.usageFlushUsers || Date.now() - lastFlush >= DEFAULTS.usageFlushIntervalMs);
  if (!due)
    return;
  await flushUsage(db);
}
__name(maybeFlushUsage, "maybeFlushUsage");
async function flushUsage(db) {
  if (pendingUsage.size === 0)
    return;
  const batch = [];
  const now = Date.now();
  for (const [id, v] of pendingUsage) {
    batch.push(
      db.prepare(
        "UPDATE users SET used_up = used_up + ?1, used_down = used_down + ?2, last_seen = ?3 WHERE id = ?4"
      ).bind(v.up, v.down, now, id)
    );
  }
  pendingUsage.clear();
  lastFlush = now;
  try {
    await db.batch(batch);
    invalidateUsers();
  } catch {
  }
}
__name(flushUsage, "flushUsage");

// src/utils/crypto.ts
var enc2 = new TextEncoder();
function bytesToHex(b) {
  let out = "";
  for (let i = 0; i < b.length; i++)
    out += b[i].toString(16).padStart(2, "0");
  return out;
}
__name(bytesToHex, "bytesToHex");
function hexToBytes(hex) {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
__name(hexToBytes, "hexToBytes");
async function sha256Hex(input) {
  const buf = await crypto.subtle.digest("SHA-256", enc2.encode(input));
  return bytesToHex(new Uint8Array(buf));
}
__name(sha256Hex, "sha256Hex");
function formatUuid(b) {
  const hex = bytesToHex(b);
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20, 32);
}
__name(formatUuid, "formatUuid");
async function uuidFromSeed(seed) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc2.encode("gozargah:" + seed)));
  const u = h.slice(0, 16);
  u[6] = u[6] & 15 | 64;
  u[8] = u[8] & 63 | 128;
  return formatUuid(u);
}
__name(uuidFromSeed, "uuidFromSeed");
function randomHex(byteLen) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLen)));
}
__name(randomHex, "randomHex");
async function pbkdf2Hex(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey("raw", enc2.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}
__name(pbkdf2Hex, "pbkdf2Hex");
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc2.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc2.encode(msg));
  return bytesToHex(new Uint8Array(sig));
}
__name(hmacHex, "hmacHex");
function constTimeEqual(a, b) {
  if (a.length !== b.length)
    return false;
  let r = 0;
  for (let i = 0; i < a.length; i++)
    r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
__name(constTimeEqual, "constTimeEqual");
function toBase64(str) {
  const bytes = enc2.encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++)
    bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
__name(toBase64, "toBase64");
function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++)
    out[i] = bin.charCodeAt(i);
  return out;
}
__name(fromBase64, "fromBase64");
function b64UrlDecode(s) {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4)
    t += "=";
  return fromBase64(t);
}
__name(b64UrlDecode, "b64UrlDecode");
function utf8Decode(b) {
  return new TextDecoder().decode(b);
}
__name(utf8Decode, "utf8Decode");
function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
__name(concatBytes, "concatBytes");
function withTimeout(p, ms, what) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(what + " (timeout " + ms + "ms)")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    );
  });
}
__name(withTimeout, "withTimeout");

// src/settings.ts
var envlessPwCache = null;
async function getEffectiveSettings(env, host) {
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
        const uuid = admin ? admin.uuid : await uuidFromSeed(host + ":admin");
        const trojanPass = admin ? admin.trojanPass : (await sha256Hex(host + ":trojan")).slice(0, 16);
        return { ...s, dbOk: true, uuid, trojanPass };
      }
    } catch {
    }
  }
  return envlessSettings(host);
}
__name(getEffectiveSettings, "getEffectiveSettings");
async function envlessSettings(host) {
  const uuid = await uuidFromSeed(host + ":admin");
  const trojanPass = (await sha256Hex(host + ":trojan")).slice(0, 16);
  let salt, hash;
  if (envlessPwCache) {
    salt = envlessPwCache.salt;
    hash = envlessPwCache.hash;
  } else {
    salt = (await sha256Hex("gz-envless-salt:" + host)).slice(0, 32);
    hash = await pbkdf2Hex(DEFAULTS.defaultPassword, salt, 2048);
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
    trojanPass
  };
}
__name(envlessSettings, "envlessSettings");
async function bootstrapSettings(env, host) {
  if (!env.GZ_DB)
    return;
  const db = env.GZ_DB;
  await ensureSchema(db);
  const existing = await loadSettings(db);
  if (existing)
    return;
  const saltHex = randomHex2(16);
  const hash = await pbkdf2Hex(DEFAULTS.defaultPassword, saltHex, DEFAULTS.pwIterations);
  const blob = {
    schemaVersion: 1,
    panelPath: DEFAULTS.panelPath,
    subPath: DEFAULTS.subPath,
    proxyIPs: [...DEFAULTS.proxyIPs],
    passwordSalt: saltHex,
    passwordHash: hash,
    pwIterations: DEFAULTS.pwIterations,
    isDefaultPassword: true,
    createdAt: Date.now()
  };
  await db.prepare("INSERT OR IGNORE INTO kv_store (key, value, rev, updated_at) VALUES (?1, ?2, 1, ?3)").bind("settings", JSON.stringify(blob), Date.now()).run();
  const uuid = await uuidFromSeed(host + ":admin");
  const trojanPass = (await sha256Hex(host + ":trojan")).slice(0, 16);
  await db.prepare(
    "INSERT OR IGNORE INTO users (name, uuid, trojan_pass, quota_bytes, expiry_at, enabled, is_admin, created_at) VALUES (?1, ?2, ?3, 0, 0, 1, 1, ?4)"
  ).bind("admin", uuid, trojanPass, Date.now()).run();
}
__name(bootstrapSettings, "bootstrapSettings");
function randomHex2(byteLen) {
  const b = crypto.getRandomValues(new Uint8Array(byteLen));
  let s = "";
  for (const v of b)
    s += v.toString(16).padStart(2, "0");
  return s;
}
__name(randomHex2, "randomHex");

// src/handlers/websocket.ts
init_config();

// src/utils/log.ts
var RING_CAP = 60;
var logRing = [];
function glog(msg) {
  const line = (/* @__PURE__ */ new Date()).toISOString() + " " + msg;
  logRing.push(line);
  if (logRing.length > RING_CAP)
    logRing.shift();
}
__name(glog, "glog");

// src/handlers/proxy.ts
init_config();
import { connect } from "cloudflare:sockets";
var DIAL_TIMEOUT_MS = 6e3;
async function dialWithFallback(host, port, proxyIPs, startIdx = 0) {
  const candidates = [host + ":" + port];
  for (let k = 0; k < proxyIPs.length; k++) {
    const ip = proxyIPs[(startIdx + k) % proxyIPs.length];
    if (ip)
      candidates.push(ip + ":" + port);
  }
  let lastErr = null;
  for (const cand of candidates) {
    let sock = null;
    try {
      sock = connect(cand);
      await withTimeout(sock.opened, DIAL_TIMEOUT_MS, "dial " + cand);
      glog("dial ok -> " + cand);
      return { socket: sock, via: cand };
    } catch (e) {
      lastErr = e;
      try {
        sock?.close();
      } catch {
      }
    }
  }
  throw new GzError("all dial attempts failed: " + String(lastErr), "dial_failed");
}
__name(dialWithFallback, "dialWithFallback");

// src/protocols/vless.ts
init_config();

// src/protocols/common.ts
init_config();
function parseAddress(chunk, i) {
  const atyp = chunk[i];
  i += 1;
  if (atyp === 1) {
    if (chunk.length < i + 4)
      throw new GzError("short ipv4 address", "bad_request");
    const host = chunk.slice(i, i + 4).join(".");
    return { host, next: i + 4 };
  }
  if (atyp === 2) {
    const len = chunk[i];
    i += 1;
    if (chunk.length < i + len)
      throw new GzError("short domain", "bad_request");
    return { host: utf8Decode(chunk.slice(i, i + len)), next: i + len };
  }
  if (atyp === 3) {
    if (chunk.length < i + 16)
      throw new GzError("short ipv6 address", "bad_request");
    const parts = [];
    for (let k = 0; k < 8; k++) {
      parts.push((chunk[i + 2 * k] << 8 | chunk[i + 2 * k + 1]).toString(16));
    }
    return { host: parts.join(":"), next: i + 16 };
  }
  throw new GzError("unsupported address type " + atyp, "bad_request");
}
__name(parseAddress, "parseAddress");

// src/protocols/vless.ts
function parseVless(chunk) {
  if (chunk.length < 24)
    throw new GzError("short vless header", "bad_request");
  const version = chunk[0];
  if (version !== 0)
    throw new GzError("unsupported vless version " + version, "bad_request");
  const uuid = formatUuid2(chunk.slice(1, 17));
  const optLen = chunk[17];
  let i = 18 + optLen;
  if (chunk.length < i + 4)
    throw new GzError("short vless header", "bad_request");
  const cmd = chunk[i];
  i += 1;
  if (cmd !== 1 && cmd !== 2)
    throw new GzError("unsupported vless command " + cmd, "bad_request");
  const port = chunk[i] << 8 | chunk[i + 1];
  i += 2;
  const addr = parseAddress(chunk, i);
  return { version, uuid, isUDP: cmd === 2, host: addr.host, port, headerLen: addr.next };
}
__name(parseVless, "parseVless");
function vlessOkResponse(version) {
  return new Uint8Array([version, 0]);
}
__name(vlessOkResponse, "vlessOkResponse");
function formatUuid2(b) {
  let hex = "";
  for (let i = 0; i < b.length; i++)
    hex += b[i].toString(16).padStart(2, "0");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20, 32);
}
__name(formatUuid2, "formatUuid");

// src/protocols/trojan.ts
init_config();
function parseTrojan(chunk) {
  if (chunk.length < 62)
    throw new GzError("short trojan header", "bad_request");
  const hash = new TextDecoder().decode(chunk.slice(0, 56));
  if (!/^[0-9a-f]{56}$/.test(hash))
    throw new GzError("bad trojan hash", "bad_request");
  if (chunk[56] !== 13 || chunk[57] !== 10)
    throw new GzError("bad trojan crlf", "bad_request");
  const cmd = chunk[58];
  if (cmd !== 1 && cmd !== 3)
    throw new GzError("unsupported trojan command " + cmd, "bad_request");
  const port = chunk[59] << 8 | chunk[60];
  const addr = parseAddress(chunk, 61);
  const i = addr.next;
  if (chunk.length < i + 2 || chunk[i] !== 13 || chunk[i + 1] !== 10) {
    throw new GzError("bad trojan crlf2", "bad_request");
  }
  return { host: addr.host, port, headerLen: i + 2, isUDP: cmd === 3 };
}
__name(parseTrojan, "parseTrojan");

// src/handlers/websocket.ts
init_config();
var IMPLICIT_USER = {
  id: 0,
  name: "admin",
  uuid: "",
  trojanPass: "",
  quotaBytes: 0,
  usedUp: 0,
  usedDown: 0,
  expiryAt: 0,
  enabled: true,
  isAdmin: true,
  createdAt: 0,
  lastSeen: 0
};
function acceptWebSocket(request, env, ctx) {
  const pair = new WebSocketPair();
  const server = pair[1];
  server.accept();
  let early = null;
  const protoHeader = request.headers.get("sec-websocket-protocol");
  if (protoHeader) {
    try {
      early = b64UrlDecode(protoHeader.trim());
    } catch {
      early = null;
    }
  }
  if (early && early.length === 0)
    early = null;
  const host = new URL(request.url).host;
  ctx.waitUntil(pumpProxy(server, early, env, host).catch((e) => {
    glog("proxy pump error: " + (e instanceof Error ? e.message : String(e)));
    try {
      server.close(1011);
    } catch {
    }
  }));
  return new Response(null, { status: 101, webSocket: pair[0] });
}
__name(acceptWebSocket, "acceptWebSocket");
function wsReadable(server) {
  return new ReadableStream({
    start(ctrl) {
      server.addEventListener("message", (ev) => {
        if (typeof ev.data === "string") {
          ctrl.enqueue(new TextEncoder().encode(ev.data));
        } else {
          ctrl.enqueue(new Uint8Array(ev.data));
        }
      });
      server.addEventListener("close", () => {
        try {
          ctrl.close();
        } catch {
        }
      });
      server.addEventListener("error", () => {
        try {
          ctrl.error(new Error("ws error"));
        } catch {
        }
      });
    }
  });
}
__name(wsReadable, "wsReadable");
async function pumpProxy(server, early, env, host) {
  const reader = wsReadable(server).getReader();
  let buf = early ?? new Uint8Array(0);
  let info = null;
  for (let guard = 0; guard < 64 && !info; guard++) {
    info = await tryParseAndResolve(buf, env, host);
    if (info)
      break;
    const { done, value } = await reader.read();
    if (done)
      throw new GzError("ws closed before full header", "bad_request");
    if (value && value.length)
      buf = concatBytes(buf, value);
  }
  if (!info)
    throw new GzError("could not parse protocol header", "bad_request");
  if (info.isUDP) {
    glog("udp requested \u2014 closing (tcp-only in v1)");
    try {
      server.close(1008);
    } catch {
    }
    return;
  }
  if (info.user) {
    const verdict = isUserAllowed(info.user);
    if (!verdict.ok) {
      glog("user blocked (" + verdict.reason + ") id=" + info.user.id);
      try {
        server.close(1008);
      } catch {
      }
      return;
    }
  } else {
    throw new GzError("auth failed", "auth_failed");
  }
  const proxyIPs = await getProxyIPs(env);
  const startIdx = info.user.isAdmin && info.user.id === 0 ? 0 : stableIndex(info.user.uuid, proxyIPs.length);
  const dial = await dialWithFallback(info.host, info.port, proxyIPs, startIdx);
  if (info.proto === "vless")
    server.send(vlessOkResponse(info.version));
  let up = 0;
  let down = 0;
  let leftover = buf.slice(info.headerLen);
  const upPipe = new ReadableStream({
    async pull(ctrl) {
      if (leftover) {
        const c = leftover;
        leftover = null;
        up += c.length;
        ctrl.enqueue(c);
        return;
      }
      const { done, value } = await reader.read();
      if (done) {
        try {
          ctrl.close();
        } catch {
        }
        return;
      }
      if (value && value.length) {
        up += value.length;
        ctrl.enqueue(value);
      }
    },
    cancel() {
      try {
        server.close();
      } catch {
      }
    }
  }).pipeTo(dial.socket.writable).catch(() => {
    try {
      dial.socket.close();
    } catch {
    }
  });
  const downPipe = dial.socket.readable.pipeTo(
    new WritableStream({
      write(chunk) {
        down += chunk.byteLength;
        server.send(chunk);
      },
      close() {
        try {
          server.close();
        } catch {
        }
      },
      abort() {
        try {
          server.close(1011);
        } catch {
        }
      }
    })
  ).catch(() => {
    try {
      server.close();
    } catch {
    }
  });
  await Promise.allSettled([upPipe, downPipe]);
  try {
    dial.socket.close();
  } catch {
  }
  try {
    server.close();
  } catch {
  }
  if (info.user && env.GZ_DB && info.user.id > 0) {
    queueUsage(info.user.id, up, down);
    await maybeFlushUsage(env.GZ_DB);
    glog("conn closed user=" + info.user.id + " up=" + up + " down=" + down + " via=" + dial.via);
  }
}
__name(pumpProxy, "pumpProxy");
function isHexByte(b) {
  return b >= 48 && b <= 57 || b >= 97 && b <= 102;
}
__name(isHexByte, "isHexByte");
function isShortError(e) {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("short");
}
__name(isShortError, "isShortError");
async function tryParseAndResolve(buf, env, host) {
  if (buf.length < 24)
    return null;
  const b0 = buf[0];
  if (b0 === 0) {
    if (buf.length < 26)
      return null;
    let req;
    try {
      req = parseVless(buf);
    } catch (e) {
      if (isShortError(e))
        return null;
      throw e;
    }
    const user = await resolveVlessUser(env, host, req.uuid);
    return { proto: "vless", headerLen: req.headerLen, version: req.version, host: req.host, port: req.port, isUDP: req.isUDP, user };
  }
  if (isHexByte(b0)) {
    if (buf.length < 68)
      return null;
    let req;
    try {
      req = parseTrojan(buf);
    } catch (e) {
      if (isShortError(e))
        return null;
      throw e;
    }
    const user = await resolveTrojanUser(env, host, utf8Decode(buf.slice(0, 56)));
    return { proto: "trojan", headerLen: req.headerLen, version: 0, host: req.host, port: req.port, isUDP: req.isUDP, user };
  }
  throw new GzError("unknown protocol first byte " + b0, "bad_request");
}
__name(tryParseAndResolve, "tryParseAndResolve");
async function resolveVlessUser(env, host, uuid) {
  if (env.GZ_DB)
    return getUserByUuid(env.GZ_DB, uuid);
  const eff = await envlessSettings(host);
  return uuid === eff.uuid ? IMPLICIT_USER : null;
}
__name(resolveVlessUser, "resolveVlessUser");
async function resolveTrojanUser(env, host, wireHash) {
  if (env.GZ_DB)
    return findUserByTrojanHash(env.GZ_DB, wireHash);
  const eff = await envlessSettings(host);
  return await sha224Hex(eff.trojanPass) === wireHash ? IMPLICIT_USER : null;
}
__name(resolveTrojanUser, "resolveTrojanUser");
async function getProxyIPs(env) {
  if (env.GZ_DB) {
    try {
      const { loadSettings: loadSettings2 } = await Promise.resolve().then(() => (init_store(), store_exports));
      const s = await loadSettings2(env.GZ_DB);
      if (s && s.proxyIPs.length)
        return s.proxyIPs;
    } catch {
    }
  }
  return [...DEFAULTS.proxyIPs];
}
__name(getProxyIPs, "getProxyIPs");
function stableIndex(seed, mod) {
  if (mod <= 1)
    return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++)
    h = h * 31 + seed.charCodeAt(i) >>> 0;
  return h % mod;
}
__name(stableIndex, "stableIndex");

// src/subscription.ts
function buildLinks(host, user) {
  const wsPath = "/" + user.uuid + "?ed=2048";
  const tag = " Gozargah \xB7 " + user.name;
  const params = "security=tls&sni=" + host + "&fp=chrome&type=ws&host=" + host + "&path=" + encodeURIComponent(wsPath);
  const vless = "vless://" + user.uuid + "@" + host + ":443?encryption=none&" + params + "#" + encodeURIComponent("VLESS" + tag);
  const trojan = "trojan://" + user.trojanPass + "@" + host + ":443?" + params + "#" + encodeURIComponent("Trojan" + tag);
  return { vless, trojan, wsPath };
}
__name(buildLinks, "buildLinks");
async function subTokenFor(host, uuid) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("gz-sub:" + host + ":" + uuid));
  const hex = [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 20);
}
__name(subTokenFor, "subTokenFor");
async function findUserByToken(db, host, token) {
  const users = await listUsers(db);
  for (const u of users) {
    if (await subTokenFor(host, u.uuid) === token)
      return u;
  }
  return null;
}
__name(findUserByToken, "findUserByToken");
function buildBase64(links) {
  return toBase64(links.map((l) => l.vless + "\n" + l.trojan).join("\n"));
}
__name(buildBase64, "buildBase64");
function buildClashYaml(host, user) {
  const wsPath = "/" + user.uuid + "?ed=2048";
  return [
    "# gozargah clash-meta profile",
    "mixed-port: 7890",
    "allow-lan: false",
    "mode: rule",
    "log-level: info",
    "dns:",
    "  enable: true",
    "  nameserver:",
    "    - 1.1.1.1",
    "    - 8.8.8.8",
    "proxies:",
    '  - name: "Gozargah-VLESS-' + user.name + '"',
    "    type: vless",
    "    server: " + host,
    "    port: 443",
    "    uuid: " + user.uuid,
    "    tls: true",
    "    servername: " + host,
    "    client-fingerprint: chrome",
    "    network: ws",
    "    udp: false",
    "    ws-opts:",
    '      path: "' + wsPath + '"',
    "      headers:",
    "        Host: " + host,
    "      max-early-data: 2048",
    "      early-data-header-name: Sec-WebSocket-Protocol",
    '  - name: "Gozargah-Trojan-' + user.name + '"',
    "    type: trojan",
    "    server: " + host,
    "    port: 443",
    "    password: " + user.trojanPass,
    "    sni: " + host,
    "    client-fingerprint: chrome",
    "    network: ws",
    "    udp: false",
    "    ws-opts:",
    '      path: "' + wsPath + '"',
    "      headers:",
    "        Host: " + host,
    "      max-early-data: 2048",
    "      early-data-header-name: Sec-WebSocket-Protocol",
    "proxy-groups:",
    "  - name: Gozargah",
    "    type: select",
    "    proxies:",
    "      - Gozargah-VLESS-" + user.name,
    "      - Gozargah-Trojan-" + user.name,
    "rules:",
    "  - MATCH,Gozargah",
    ""
  ].join("\n");
}
__name(buildClashYaml, "buildClashYaml");
function buildSingBoxJson(host, user) {
  const wsPath = "/" + user.uuid + "?ed=2048";
  const tls = { enabled: true, server_name: host, utls: { enabled: true, fingerprint: "chrome" } };
  const transport = {
    type: "ws",
    path: wsPath,
    headers: { Host: host },
    max_early_data: 2048,
    early_data_header_name: "Sec-WebSocket-Protocol"
  };
  const cfg = {
    log: { level: "info" },
    dns: { servers: ["1.1.1.1", "8.8.8.8"] },
    inbounds: [{ type: "mixed", tag: "mixed-in", listen: "127.0.0.1", listen_port: 2080 }],
    outbounds: [
      {
        type: "vless",
        tag: "Gozargah-VLESS-" + user.name,
        server: host,
        server_port: 443,
        uuid: user.uuid,
        tls,
        transport
      },
      {
        type: "trojan",
        tag: "Gozargah-Trojan-" + user.name,
        server: host,
        server_port: 443,
        password: user.trojanPass,
        tls,
        transport
      },
      { type: "direct", tag: "direct" }
    ],
    route: { final: "Gozargah-VLESS-" + user.name }
  };
  return JSON.stringify(cfg, null, 2);
}
__name(buildSingBoxJson, "buildSingBoxJson");
function sniffApp(ua) {
  const s = ua.toLowerCase();
  if (s.includes("clash") || s.includes("stash") || s.includes("vera") || s.includes("hiddify-clash"))
    return "clash";
  if (s.includes("sing-box") || s.includes("singbox") || s.includes("karing") || s.includes("hiddify"))
    return "singbox";
  return "v2ray";
}
__name(sniffApp, "sniffApp");
function subHeaders(eff, host, user, app) {
  const h = new Headers();
  if (app === "clash")
    h.set("content-type", "text/yaml; charset=utf-8");
  else if (app === "singbox")
    h.set("content-type", "application/json; charset=utf-8");
  else
    h.set("content-type", "text/plain; charset=utf-8");
  h.set("access-control-allow-origin", "*");
  h.set("cache-control", "no-store");
  h.set("profile-title", "Gozargah \xB7 " + user.name);
  h.set("profile-update-interval", "6");
  h.set("profile-web-page-url", "https://" + host + "/" + eff.panelPath);
  if (user.quotaBytes || user.expiryAt) {
    const used = Math.max(0, user.usedUp + user.usedDown);
    h.set(
      "subscription-userinfo",
      "upload=" + user.usedUp + "; download=" + user.usedDown + "; total=" + (user.quotaBytes || 0) + "; expire=" + (user.expiryAt ? Math.floor(user.expiryAt / 1e3) : 0)
    );
    h.set("x-gz-used-bytes", String(used));
  }
  return h;
}
__name(subHeaders, "subHeaders");
function renderSub(app, host, user) {
  const links = buildLinks(host, user);
  if (app === "clash")
    return { body: buildClashYaml(host, user), app };
  if (app === "singbox")
    return { body: buildSingBoxJson(host, user), app };
  return { body: buildBase64([links]), app: "v2ray" };
}
__name(renderSub, "renderSub");

// src/panel/api.ts
init_config();
init_store();

// src/auth.ts
init_config();
init_store();
var COOKIE = "gz_session";
function sessionSecret(eff) {
  return sha256Hex(eff.passwordHash + ":" + eff.panelPath);
}
__name(sessionSecret, "sessionSecret");
async function verifyPanelPassword(eff, password) {
  const h = await pbkdf2Hex(password, eff.passwordSalt, eff.pwIterations);
  return constTimeEqual(h, eff.passwordHash);
}
__name(verifyPanelPassword, "verifyPanelPassword");
async function makeSessionToken(eff) {
  const exp = String(Date.now() + DEFAULTS.sessionTtlMs);
  const sig = await hmacHex(await sessionSecret(eff), exp);
  return exp + "." + sig;
}
__name(makeSessionToken, "makeSessionToken");
async function verifySessionToken(eff, token) {
  if (!token)
    return false;
  const dot = token.indexOf(".");
  if (dot <= 0)
    return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d{13,16}$/.test(exp) || Number(exp) < Date.now())
    return false;
  const want = await hmacHex(await sessionSecret(eff), exp);
  return constTimeEqual(sig, want);
}
__name(verifySessionToken, "verifySessionToken");
function readSessionCookie(request) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === COOKIE)
      return rest.join("=");
  }
  return null;
}
__name(readSessionCookie, "readSessionCookie");
function sessionCookie(token) {
  return COOKIE + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + Math.floor(DEFAULTS.sessionTtlMs / 1e3);
}
__name(sessionCookie, "sessionCookie");
function clearedCookie() {
  return COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}
__name(clearedCookie, "clearedCookie");
async function isAuthed(request, eff) {
  const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") || null;
  const token = readSessionCookie(request) ?? bearer;
  return verifySessionToken(eff, token);
}
__name(isAuthed, "isAuthed");
async function requireAuth(request, eff) {
  if (!await isAuthed(request, eff))
    throw new GzError("unauthorized", "unauthorized");
}
__name(requireAuth, "requireAuth");
async function ipHash(request) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  return sha256Hex("gzip:" + ip);
}
__name(ipHash, "ipHash");
async function checkLoginGate(env, request) {
  const h = await ipHash(request);
  if (env.GZ_DB) {
    const left = await loginAttemptsLeft(env.GZ_DB, h);
    return { allowed: left > 0, attemptsLeft: left };
  }
  const cur = memThrottle.get(h);
  if (cur && Date.now() - cur.windowStart < DEFAULTS.loginWindowMs && cur.count >= DEFAULTS.loginMaxAttempts) {
    return { allowed: false, attemptsLeft: 0 };
  }
  return { allowed: true, attemptsLeft: DEFAULTS.loginMaxAttempts };
}
__name(checkLoginGate, "checkLoginGate");
async function onLoginResult(env, request, success) {
  const h = await ipHash(request);
  if (env.GZ_DB) {
    if (success)
      await clearLoginThrottle(env.GZ_DB, h);
    else
      await recordLoginFailure(env.GZ_DB, h);
    return;
  }
  if (success)
    memThrottle.delete(h);
  else {
    const cur = memThrottle.get(h);
    if (cur && Date.now() - cur.windowStart < DEFAULTS.loginWindowMs)
      cur.count += 1;
    else
      memThrottle.set(h, { count: 1, windowStart: Date.now() });
  }
}
__name(onLoginResult, "onLoginResult");
var memThrottle = /* @__PURE__ */ new Map();

// src/panel/api.ts
var JSON_CT = "application/json; charset=utf-8";
function json(data, status = 200, extraHeaders) {
  const h = extraHeaders ?? new Headers();
  h.set("content-type", JSON_CT);
  h.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: h });
}
__name(json, "json");
function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    uuid: u.uuid,
    trojanPass: u.trojanPass,
    quotaBytes: u.quotaBytes,
    usedUp: u.usedUp,
    usedDown: u.usedDown,
    expiryAt: u.expiryAt,
    enabled: u.enabled,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt,
    lastSeen: u.lastSeen
  };
}
__name(publicUser, "publicUser");
async function handlePanelApi(request, env, eff, action) {
  const method = request.method;
  const db = env.GZ_DB;
  try {
    if (action === "status" && method === "GET") {
      return json({
        version: VERSION,
        dbOk: eff.dbOk,
        isDefaultPassword: eff.isDefaultPassword,
        host: new URL(request.url).hostname,
        logs: logRing.slice(-12)
      });
    }
    if (action === "login" && method === "POST") {
      const gate = await checkLoginGate(env, request);
      if (!gate.allowed) {
        await addEvent(db, "login_blocked", "rate limit reached");
        return json({ error: "too_many_attempts", attemptsLeft: 0 }, 429);
      }
      const body = await request.json().catch(() => ({}));
      const ok = await verifyPanelPassword(eff, String(body.password ?? ""));
      await onLoginResult(env, request, ok);
      if (!ok) {
        if (db)
          await addEvent(db, "login_failed", "bad password");
        return json({ error: "bad_password", attemptsLeft: gate.attemptsLeft - 1 }, 401);
      }
      if (db)
        await addEvent(db, "login_ok", "panel login");
      const token = await makeSessionToken(eff);
      return json({ ok: true }, 200, new Headers({ "set-cookie": sessionCookie(token) }));
    }
    if (action === "logout" && method === "POST") {
      return json({ ok: true }, 200, new Headers({ "set-cookie": clearedCookie() }));
    }
    await requireAuth(request, eff);
    if (action === "me" && method === "GET") {
      return json({ ok: true, version: VERSION, dbOk: eff.dbOk, isDefaultPassword: eff.isDefaultPassword });
    }
    if (action === "settings" && method === "GET") {
      const s = db ? await loadSettings(db) : null;
      return json({
        panelPath: s?.panelPath ?? eff.panelPath,
        subPath: s?.subPath ?? eff.subPath,
        proxyIPs: s?.proxyIPs ?? eff.proxyIPs,
        isDefaultPassword: s?.isDefaultPassword ?? eff.isDefaultPassword,
        dbOk: eff.dbOk
      });
    }
    if (action === "settings" && method === "POST") {
      if (!db)
        throw new GzError("database_not_bound", "no_db");
      const body = await request.json().catch(() => ({}));
      const next = await saveSettings(db, (prev) => {
        const cur = prev ?? {
          schemaVersion: 1,
          panelPath: eff.panelPath,
          subPath: eff.subPath,
          proxyIPs: eff.proxyIPs,
          passwordSalt: eff.passwordSalt,
          passwordHash: eff.passwordHash,
          pwIterations: eff.pwIterations,
          isDefaultPassword: eff.isDefaultPassword,
          createdAt: Date.now()
        };
        const out = { ...cur };
        if (typeof body.panelPath === "string") {
          const v = body.panelPath.trim().toLowerCase();
          if (!/^[a-z0-9][a-z0-9-]{2,31}$/.test(v))
            throw new GzError("invalid panelPath", "validation");
          out.panelPath = v;
        }
        if (typeof body.subPath === "string") {
          const v = body.subPath.trim().toLowerCase();
          if (!/^[a-z0-9][a-z0-9-]{2,31}$/.test(v))
            throw new GzError("invalid subPath", "validation");
          out.subPath = v;
        }
        if (Array.isArray(body.proxyIPs)) {
          const ips = body.proxyIPs.map((x) => String(x).trim()).filter((x) => /^[a-z0-9.\-:]+$/i.test(x) && x.length <= 253);
          if (ips.length > 32)
            throw new GzError("too many proxyIPs", "validation");
          out.proxyIPs = ips.length ? ips : ["proxyip.cmliussss.net"];
        }
        if (typeof body.newPassword === "string" && body.newPassword.length > 0) {
          const pw = body.newPassword;
          if (pw.length < 8)
            throw new GzError("password too short (min 8)", "validation");
          out.passwordSalt = randomHex(16);
          out.pwIterations = eff.pwIterations;
          out.__newPw = pw;
        }
        return out;
      });
      const marker = next;
      if (marker.__newPw) {
        const pw = marker.__newPw;
        delete marker.__newPw;
        const salt = randomHex(16);
        const hash = await pbkdf2Hex(pw, salt, eff.pwIterations);
        marker.passwordSalt = salt;
        marker.passwordHash = hash;
        marker.isDefaultPassword = false;
        await saveSettings(db, () => marker);
        invalidateUsers();
        invalidateCache();
        await addEvent(db, "password_changed", "panel password updated");
      }
      invalidateCache();
      return json({ ok: true });
    }
    if (action === "users" && method === "GET") {
      if (!db)
        throw new GzError("database_not_bound", "no_db");
      const users = await listUsers(db);
      const withTokens = [];
      const host = new URL(request.url).hostname;
      for (const u of users) {
        withTokens.push({ ...publicUser(u), subToken: await subTokenFor(host, u.uuid) });
      }
      return json({ users: withTokens });
    }
    if (action === "users" && method === "POST") {
      if (!db)
        throw new GzError("database_not_bound", "no_db");
      const body = await request.json().catch(() => ({}));
      const name = String(body.name ?? "").trim().slice(0, 32);
      if (!/^[\w\u0600-\u06FF .-]{1,32}$/.test(name))
        throw new GzError("invalid name", "validation");
      const quotaGB = Number(body.quotaGB ?? 0);
      if (!Number.isFinite(quotaGB) || quotaGB < 0 || quotaGB > 1024 * 100)
        throw new GzError("invalid quotaGB", "validation");
      const expiryAt = Number(body.expiryAt ?? 0);
      if (!Number.isFinite(expiryAt) || expiryAt < 0)
        throw new GzError("invalid expiryAt", "validation");
      const u = await createUser(db, { name, quotaBytes: Math.round(quotaGB * 1024 ** 3), expiryAt });
      await addEvent(db, "user_created", name);
      return json({ user: publicUser(u) }, 201);
    }
    const userMatch = action.match(/^users\/(\d+)$/);
    if (userMatch) {
      if (!db)
        throw new GzError("database_not_bound", "no_db");
      const id = Number(userMatch[1]);
      if (method === "PATCH") {
        const body = await request.json().catch(() => ({}));
        const patch = {};
        if (typeof body.name === "string") {
          const n = body.name.trim().slice(0, 32);
          if (!/^[\w\u0600-\u06FF .-]{1,32}$/.test(n))
            throw new GzError("invalid name", "validation");
          patch.name = n;
        }
        if (body.quotaGB !== void 0) {
          const q = Number(body.quotaGB);
          if (!Number.isFinite(q) || q < 0)
            throw new GzError("invalid quotaGB", "validation");
          patch.quotaBytes = Math.round(q * 1024 ** 3);
        }
        if (body.expiryAt !== void 0) {
          const x = Number(body.expiryAt);
          if (!Number.isFinite(x) || x < 0)
            throw new GzError("invalid expiryAt", "validation");
          patch.expiryAt = x;
        }
        if (body.enabled !== void 0)
          patch.enabled = !!body.enabled;
        if (body.resetUsage === true) {
          patch.usedUp = 0;
          patch.usedDown = 0;
        }
        if (body.rotateCredentials === true) {
          const u = (await listUsers(db)).find((x) => x.id === id);
          if (u?.isAdmin)
            throw new GzError("cannot rotate admin credentials (reset D1 instead)", "validation");
          patch.uuid = crypto.randomUUID();
          patch.trojanPass = randomHex(12);
        }
        await updateUser(db, id, patch);
        if (patch.usedUp !== void 0 || patch.usedDown !== void 0)
          await flushUsage(db);
        await addEvent(db, "user_updated", "id=" + id);
        return json({ ok: true });
      }
      if (method === "DELETE") {
        await deleteUser(db, id);
        await addEvent(db, "user_deleted", "id=" + id);
        return json({ ok: true });
      }
    }
    const linksMatch = action.match(/^users\/(\d+)\/links$/);
    if (linksMatch && method === "GET") {
      if (!db)
        throw new GzError("database_not_bound", "no_db");
      const id = Number(linksMatch[1]);
      const u = (await listUsers(db)).find((x) => x.id === id);
      if (!u)
        throw new GzError("user not found", "not_found");
      const host = new URL(request.url).hostname;
      const links = buildLinks(host, u);
      return json({
        links,
        subBase: "https://" + host + "/" + eff.subPath + "/" + await subTokenFor(host, u.uuid),
        subClash: "https://" + host + "/" + eff.subPath + "/" + await subTokenFor(host, u.uuid) + "/clash",
        subSingbox: "https://" + host + "/" + eff.subPath + "/" + await subTokenFor(host, u.uuid) + "/singbox"
      });
    }
    if (action === "events" && method === "GET") {
      if (!db)
        return json({ events: [] });
      return json({ events: await recentEvents(db, 10) });
    }
    return json({ error: "not_found" }, 404);
  } catch (e) {
    if (e instanceof GzError && e.code === "unauthorized") {
      return json({ error: "unauthorized" }, 401);
    }
    if (e instanceof GzError && e.code === "validation") {
      return json({ error: e.message }, 400);
    }
    if (e instanceof GzError && e.code === "no_db") {
      return json({ error: "database_not_bound" }, 503);
    }
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
__name(handlePanelApi, "handlePanelApi");

// src/panel/styles.ts
var PANEL_CSS = `
:root{
  --bg:#05060a; --bg2:#0a0d16;
  --card:rgba(255,255,255,.045); --card2:rgba(255,255,255,.07);
  --line:rgba(255,255,255,.09); --line2:rgba(255,255,255,.16);
  --txt:#e9edf6; --mut:#8e97ad; --mut2:#5b6478;
  --c1:#2cc9ff; --c2:#8b5cf6; --c3:#c026d3;
  --ok:#34d399; --warn:#fbbf24; --bad:#fb7185;
  --grad:linear-gradient(120deg,var(--c1),var(--c2) 52%,var(--c3));
  --grad-soft:linear-gradient(120deg,rgba(44,201,255,.16),rgba(139,92,246,.16) 52%,rgba(192,38,211,.16));
  --r-lg:22px; --r-md:16px; --r-sm:11px;
  --shadow:0 18px 50px -18px rgba(0,0,0,.65);
  --glow:0 10px 34px -10px rgba(139,92,246,.55);
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{
  font-family:'Vazirmatn',system-ui,-apple-system,'Segoe UI',sans-serif;
  background:var(--bg);color:var(--txt);min-height:100vh;
  font-size:14.5px;line-height:1.75;
}
.gz-bg{position:fixed;inset:0;z-index:-1;background:var(--bg);overflow:hidden}
.gz-bg::before{content:'';position:absolute;width:56vmax;height:56vmax;top:-22vmax;inset-inline-start:-14vmax;border-radius:50%;
  background:radial-gradient(circle,rgba(44,201,255,.13),transparent 62%);filter:blur(30px);animation:drift 26s ease-in-out infinite alternate}
.gz-bg::after{content:'';position:absolute;width:52vmax;height:52vmax;bottom:-24vmax;inset-inline-end:-12vmax;border-radius:50%;
  background:radial-gradient(circle,rgba(192,38,211,.12),transparent 62%);filter:blur(34px);animation:drift 32s ease-in-out infinite alternate-reverse}
@keyframes drift{from{transform:translate(0,0) scale(1)}to{transform:translate(6vmax,4vmax) scale(1.12)}}

.wrap{max-width:1060px;margin:0 auto;padding:0 18px 80px}
.topbar{position:sticky;top:0;z-index:50;backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
  background:rgba(5,6,10,.72);border-bottom:1px solid var(--line)}
.topbar-in{max-width:1060px;margin:0 auto;padding:12px 18px;display:flex;align-items:center;gap:14px}
.brand{display:flex;align-items:center;gap:12px;min-width:0}
.brand img{width:42px;height:42px;border-radius:12px;box-shadow:0 0 0 1px var(--line2),0 8px 24px -8px rgba(139,92,246,.5)}
.brand b{font-size:17px;font-weight:800;letter-spacing:.2px;display:block;line-height:1.3}
.brand small{color:var(--mut);font-size:11.5px;display:block}
.top-actions{margin-inline-start:auto;display:flex;gap:9px;align-items:center}
.vchip{font-size:11px;color:var(--mut);border:1px solid var(--line);padding:3px 10px;border-radius:99px;white-space:nowrap}

.glass{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:var(--shadow)}
.gradline{height:2px;background:var(--grad);border-radius:99px;opacity:.9}
.gradtext{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;cursor:pointer;
  font-family:inherit;font-size:13.5px;font-weight:700;padding:10px 20px;border-radius:var(--r-sm);
  color:var(--txt);background:var(--card2);border:1px solid var(--line);transition:all .18s ease;user-select:none}
.btn:hover{border-color:var(--line2);background:rgba(255,255,255,.1)}
.btn:active{transform:scale(.97)}
.btn.primary{background:var(--grad);color:#07080f;border:none;box-shadow:var(--glow)}
.btn.primary:hover{filter:brightness(1.1);transform:translateY(-1px)}
.btn.danger{color:var(--bad);border-color:rgba(251,113,133,.35)}
.btn.danger:hover{background:rgba(251,113,133,.12)}
.btn.ghost{background:transparent}
.btn.sm{padding:6px 13px;font-size:12.5px;border-radius:9px}
.btn.icon{padding:8px 10px}

/* fields */
.field{margin-bottom:16px}
.field label{display:block;font-size:12.5px;color:var(--mut);margin-bottom:7px;font-weight:600}
.field .hint{font-size:11px;color:var(--mut2);margin-top:5px}
input[type=text],input[type=password],input[type=number],input[type=date],input[type=datetime-local],textarea{
  width:100%;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:var(--r-sm);
  color:var(--txt);font-family:inherit;font-size:13.5px;padding:10px 14px;outline:none;transition:border .18s, box-shadow .18s}
textarea{resize:vertical;min-height:84px;direction:ltr;text-align:left;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
input:focus,textarea:focus{border-color:rgba(44,201,255,.55);box-shadow:0 0 0 3px rgba(44,201,255,.14)}
input.mono{direction:ltr;text-align:left;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}

/* login */
.auth-wrap{min-height:calc(100vh - 70px);display:flex;align-items:center;justify-content:center;padding:30px 0}
.auth-card{width:min(420px,94vw);padding:34px 30px 28px;text-align:center;position:relative;overflow:hidden}
.auth-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--grad)}
.auth-card .emblem{width:92px;margin:0 auto 6px}
.auth-card h2{font-size:20px;font-weight:800;margin-bottom:2px}
.auth-card p{color:var(--mut);font-size:12.5px;margin-bottom:22px}
.auth-err{color:var(--bad);font-size:12px;min-height:18px;margin-bottom:6px}

/* tabs */
.tabs{display:flex;gap:4px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:5px;margin:22px 0 20px;position:relative}
.tab{flex:1;text-align:center;padding:9px 6px;border-radius:10px;cursor:pointer;color:var(--mut);font-weight:700;font-size:13.5px;transition:all .18s;border:none;background:none;font-family:inherit}
.tab:hover{color:var(--txt)}
.tab.on{color:#07080f;background:var(--grad);box-shadow:var(--glow)}

/* hero + stats */
.hero{display:flex;align-items:center;gap:18px;padding:24px 26px;margin-bottom:16px;position:relative;overflow:hidden}
.hero .emblem{width:74px;flex-shrink:0}
.hero h1{font-size:21px;font-weight:800}
.hero p{color:var(--mut);font-size:12.5px}
.hero .sub-chip{margin-inline-start:auto;max-width:46%}
@media(max-width:720px){.hero{flex-direction:column;text-align:center}.hero .sub-chip{margin:0;max-width:100%;width:100%}}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px}
.stat{padding:16px 18px;border-radius:var(--r-md);background:var(--card);border:1px solid var(--line)}
.stat .k{font-size:11.5px;color:var(--mut);margin-bottom:6px;font-weight:600}
.stat .v{font-size:19px;font-weight:800}
.stat .v small{font-size:11px;color:var(--mut);font-weight:400}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-inline-end:6px;vertical-align:1px}
.dot.ok{background:var(--ok);box-shadow:0 0 8px var(--ok)}
.dot.bad{background:var(--bad);box-shadow:0 0 8px var(--bad)}
.warnbox{display:flex;gap:10px;align-items:center;padding:13px 16px;border-radius:var(--r-md);margin-bottom:16px;
  background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);color:#fde68a;font-size:12.5px}

/* link chips */
.chip-row{display:flex;gap:9px;align-items:center;background:rgba(255,255,255,.035);border:1px solid var(--line);
  border-radius:var(--r-sm);padding:9px 12px;min-width:0}
.chip-row .lbl{font-size:11px;color:var(--mut);white-space:nowrap;font-weight:700}
.chip-row .val{flex:1;direction:ltr;text-align:left;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#bcd3ea;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}

/* user cards */
.users-head{display:flex;align-items:center;margin-bottom:14px;gap:10px}
.users-head h3{font-size:16px;font-weight:800}
.users-head .btn{margin-inline-start:auto}
.user-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.ucard{padding:18px;display:flex;flex-direction:column;gap:10px;transition:transform .18s,border-color .18s;position:relative}
.ucard:hover{transform:translateY(-2px);border-color:var(--line2)}
.ucard .row1{display:flex;align-items:center;gap:9px}
.ucard .uname{font-weight:800;font-size:15px}
.badge{font-size:10px;padding:2px 9px;border-radius:99px;background:var(--grad-soft);border:1px solid rgba(139,92,246,.4);color:#d8c9ff;font-weight:700}
.chip{font-size:10.5px;padding:2px 9px;border-radius:99px;font-weight:700;border:1px solid var(--line)}
.chip.ok{color:var(--ok);border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.08)}
.chip.warn{color:var(--warn);border-color:rgba(251,191,36,.4);background:rgba(251,191,36,.08)}
.chip.bad{color:var(--bad);border-color:rgba(251,113,133,.4);background:rgba(251,113,133,.08)}
.ucard .meta{font-size:11.5px;color:var(--mut);display:flex;flex-wrap:wrap;gap:4px 14px}
.pbar{height:7px;border-radius:99px;background:rgba(255,255,255,.06);overflow:hidden}
.pbar i{display:block;height:100%;background:var(--grad);border-radius:99px;box-shadow:0 0 10px rgba(139,92,246,.6);transition:width .5s ease}
.ucard .btns{display:flex;gap:7px;flex-wrap:wrap}

/* setup */
.steps{counter-reset:s;list-style:none;display:flex;flex-direction:column;gap:12px;margin:18px 0}
.steps li{counter-increment:s;display:flex;gap:13px;align-items:flex-start;background:var(--card);border:1px solid var(--line);
  border-radius:var(--r-md);padding:14px 16px;font-size:13px}
.steps li::before{content:counter(s);flex-shrink:0;width:27px;height:27px;border-radius:9px;background:var(--grad);
  color:#07080f;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:13px;margin-top:2px}

/* events */
.events{margin-top:20px}
.events h4{font-size:13px;color:var(--mut);margin-bottom:9px;font-weight:700}
.ev{display:flex;gap:10px;font-size:11.5px;color:var(--mut);padding:7px 12px;border-bottom:1px dashed var(--line)}
.ev b{color:var(--txt);font-weight:600}
.ev time{margin-inline-start:auto;direction:ltr;color:var(--mut2);font-size:10.5px}

/* modal */
.modal-bg{position:fixed;inset:0;background:rgba(3,4,8,.7);backdrop-filter:blur(6px);z-index:100;
  display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .18s ease}
.modal{width:min(560px,96vw);max-height:88vh;overflow:auto;padding:24px;animation:popIn .22s cubic-bezier(.2,.9,.3,1.2)}
.modal h3{font-size:16px;font-weight:800;margin-bottom:16px}
.modal .close-x{float:inset-inline-end}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes popIn{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:none}}

/* toasts */
#toasts{position:fixed;bottom:20px;inset-inline-start:20px;z-index:200;display:flex;flex-direction:column;gap:9px}
.toast{background:rgba(13,16,26,.92);border:1px solid var(--line2);border-radius:13px;padding:11px 17px;font-size:13px;
  box-shadow:var(--shadow);animation:toastIn .25s cubic-bezier(.2,.9,.3,1.15);max-width:320px;border-inline-start:3px solid var(--c1)}
.toast.err{border-inline-start-color:var(--bad)}
.toast.ok{border-inline-start-color:var(--ok)}
@keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}

/* emblem */
.emblem svg{display:block;width:100%;height:auto}
.emblem .draw{stroke-dasharray:340;stroke-dashoffset:340;animation:draw 1.5s ease forwards .2s}
@keyframes draw{to{stroke-dashoffset:0}}

/* scrollbars */
::-webkit-scrollbar{width:9px;height:9px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:99px}
::-webkit-scrollbar-track{background:transparent}

.hidden{display:none !important}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:640px){.two-col{grid-template-columns:1fr}}
[dir=ltr] .val{text-align:left}
a{color:var(--c1)}
`;

// src/panel/script.ts
var PANEL_JS = String.raw`
(function () {
  'use strict';
  var GZ = window.__GZ__ || {};
  if (!GZ.panelPath) GZ.panelPath = 'gozargah';
  var S = { lang: localStorage.getItem('gz_lang') || GZ.lang || 'fa', status: null, users: [], settings: null, events: [] };

  /* ---------------- helpers ---------------- */
  function $(s) { return document.querySelector(s); }
  function $all(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function t(k) { var d = window.__GZ_I18N__ || {}; return d[k] || k; }

  function toast(msg, kind) {
    var box = $('#toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
    setTimeout(function () { el.remove(); }, 3000);
  }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    return fetch(GZ.panelPath + '/api' + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && path !== '/login') { showView('login'); throw new Error('unauthorized'); }
        if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
        return j;
      });
    });
  }

  function copyText(txt, btn) {
    function done() { if (btn) { var o = btn.textContent; btn.textContent = t('copied'); setTimeout(function () { btn.textContent = o; }, 1200); } }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast(t('error'), 'err'); }
      ta.remove();
    }
  }

  function fmtBytes(n) {
    n = Number(n) || 0;
    if (n <= 0) return '<span dir="ltr" style="display:inline-block">0 B</span>';
    var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return '<span dir="ltr" style="display:inline-block">' + (i === 0 ? n : n.toFixed(n >= 100 ? 0 : 1)) + ' ' + u[i] + '</span>';
  }
  function fmtDate(ms) {
    if (!ms) return t('never');
    try { return new Date(ms).toLocaleDateString(S.lang === 'fa' ? 'fa-IR' : 'en-GB'); } catch (e) { return new Date(ms).toISOString().slice(0, 10); }
  }
  function fmtTime(ts) {
    try { return new Date(ts).toLocaleTimeString(S.lang === 'fa' ? 'fa-IR' : 'en-GB'); } catch (e) { return ''; }
  }

  /* ---------------- i18n ---------------- */
  function applyI18n() {
    window.__GZ_I18N__ = (window.__GZ_DICT__ || {})[S.lang] || (window.__GZ_DICT__ || {}).fa || {};
    document.documentElement.dir = S.lang === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = S.lang;
    $all('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $('#lang-btn').textContent = t('lang');
  }

  /* ---------------- views ---------------- */
  function showView(v) {
    $('#v-login').classList.toggle('hidden', v !== 'login');
    $('#v-setup').classList.toggle('hidden', v !== 'setup');
    $('#v-main').classList.toggle('hidden', v !== 'main');
    $('#logout-btn').classList.toggle('hidden', v !== 'main');
  }

  /* ---------------- boot ---------------- */
  function boot() {
    applyI18n();
    if (GZ.logo) { $('#brand-logo').src = GZ.logo; var l = document.createElement('link'); l.rel = 'icon'; l.href = GZ.favicon || GZ.logo; document.head.appendChild(l); }
    if (GZ.mock) { renderMock(); return; }
    fetch(GZ.panelPath + '/api/status').then(function (r) { return r.json(); }).then(function (st) {
      S.status = st;
      $('#ver').textContent = st.version || GZ.version || '';
      setDbChip(st.dbOk);
      if (!st.dbOk) { showView('setup'); return; }
      api('/me').then(function () { showView('main'); loadAll(); }, function () { /* 401 -> view login set in api() */ });
    }).catch(function () { showView('login'); });
  }

  function setDbChip(ok) {
    var c = $('#db-chip');
    c.innerHTML = '<span class="dot ' + (ok ? 'ok' : 'bad') + '"></span>' + t('database') + ': ' + (ok ? t('connected') : t('notConnected'));
  }

  function loadAll() {
    loadUsers(); loadSettings(); loadEvents(); renderDash();
  }

  /* ---------------- dashboard ---------------- */
  function renderDash() {
    var st = S.status || {};
    var admin = null;
    for (var i = 0; i < S.users.length; i++) if (S.users[i].isAdmin) admin = S.users[i];
    var total = 0, quotaSum = 0;
    S.users.forEach(function (u) { total += u.usedUp + u.usedDown; quotaSum += u.quotaBytes; });
    var cards = [
      { k: t('host'), v: '<span style="direction:ltr;display:inline-block">' + esc(st.host || location.hostname) + '</span>' },
      { k: t('version'), v: esc(st.version || GZ.version) },
      { k: t('usersCount'), v: String(S.users.length) },
      { k: t('realBytes'), v: fmtBytes(total) }
    ];
    $('#stat-grid').innerHTML = cards.map(function (c) {
      return '<div class="stat"><div class="k">' + c.k + '</div><div class="v">' + c.v + '</div></div>';
    }).join('');
    $('#hero-ver').textContent = 'v' + (st.version || GZ.version || '');
    $('#pw-warn').classList.toggle('hidden', !(st.isDefaultPassword || GZ.isDefaultPassword));
    if (admin) {
      var sub = location.origin + '/' + (S.settings ? S.settings.subPath : 'sub') + '/' + (admin.subToken || '');
      $('#admin-sub').textContent = sub;
      $('#admin-sub').setAttribute('data-copy', sub);
    }
    setDbChip(st.dbOk);
  }

  function loadEvents() {
    if (GZ.mock) return;
    api('/events').then(function (r) {
      S.events = r.events || [];
      var box = $('#ev-list');
      if (!S.events.length) { box.innerHTML = '<div class="ev">' + esc(t('noEvents')) + '</div>'; return; }
      box.innerHTML = S.events.map(function (e) {
        return '<div class="ev"><b>' + esc(e.type) + '</b><span>' + esc(e.detail) + '</span><time>' + fmtTime(e.ts) + '</time></div>';
      }).join('');
    }).catch(function () {});
  }

  /* ---------------- users ---------------- */
  function loadUsers() {
    if (GZ.mock) return;
    api('/users').then(function (r) { S.users = r.users || []; renderDash(); renderUsers(); })
      .catch(function (e) { if (e.message !== 'unauthorized') toast(e.message, 'err'); });
  }

  function userState(u) {
    var now = Date.now();
    if (!u.enabled) return { chip: 'bad', label: t('disabled') };
    if (u.expiryAt && now > u.expiryAt) return { chip: 'warn', label: t('expired') };
    if (u.quotaBytes && u.usedUp + u.usedDown >= u.quotaBytes) return { chip: 'warn', label: t('quotaReached') };
    return { chip: 'ok', label: t('active') };
  }

  function renderUsers() {
    var grid = $('#user-grid');
    if (!S.users.length) { grid.innerHTML = '<div class="glass" style="padding:22px;color:var(--mut)">' + esc(t('noUsers')) + '</div>'; return; }
    grid.innerHTML = S.users.map(function (u) {
      var used = u.usedUp + u.usedDown;
      var pct = u.quotaBytes ? Math.min(100, Math.round(used / u.quotaBytes * 100)) : 0;
      var st = userState(u);
      var bar = u.quotaBytes
        ? '<div class="pbar"><i style="width:' + pct + '%"></i></div><div class="meta" style="margin-top:5px"><span>' + esc(t('used')) + ': ' + fmtBytes(used) + '</span><span>' + esc(t('of')) + ' ' + (u.isAdmin ? esc(t('unlimited')) : fmtBytes(u.quotaBytes)) + '</span></div>'
        : '<div class="meta"><span>' + esc(t('used')) + ': ' + fmtBytes(used) + '</span><span>' + esc(t('unlimited')) + '</span></div>';
      var meta =
        '<span>' + esc(t('expiry')) + ': ' + fmtDate(u.expiryAt) + '</span>' +
        '<span>' + esc(t('seen')) + ': ' + (u.lastSeen ? fmtDate(u.lastSeen) : esc(t('neverSeen'))) + '</span>';
      var btns =
        '<button class="btn sm primary" data-act="links" data-id="' + u.id + '">' + esc(t('clientLinks')) + '</button>' +
        (u.isAdmin ? '' :
          '<button class="btn sm" data-act="edit" data-id="' + u.id + '">' + esc(t('edit')) + '</button>' +
          '<button class="btn sm danger" data-act="del" data-id="' + u.id + '">' + esc(t('delete')) + '</button>');
      return '<div class="ucard glass">' +
        '<div class="row1"><span class="uname">' + esc(u.name) + '</span>' +
        (u.isAdmin ? '<span class="badge">' + esc(t('adminBadge')) + '</span>' : '') +
        '<span class="chip ' + st.chip + '" style="margin-inline-start:auto">' + esc(st.label) + '</span></div>' +
        bar + '<div class="meta">' + meta + '</div>' +
        '<div class="btns">' + btns + '</div></div>';
    }).join('');
    $all('#user-grid [data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = Number(b.getAttribute('data-id'));
        var act = b.getAttribute('data-act');
        var u = S.users.find(function (x) { return x.id === id; });
        if (act === 'links') openLinks(u);
        else if (act === 'edit') openEditUser(u);
        else if (act === 'del') confirmDelete(u);
      });
    });
  }

  function openLinks(u) {
    if (GZ.mock) { mockLinks(u); return; }
    api('/users/' + u.id + '/links').then(function (r) {
      var rows = [
        { l: 'VLESS', v: r.links.vless },
        { l: 'Trojan', v: r.links.trojan },
        { l: t('subBase'), v: r.subBase },
        { l: t('subClash'), v: r.subClash },
        { l: t('subSingbox'), v: r.subSingbox }
      ];
      var html = '<button class="btn sm icon close-x" data-close="1">✕</button><h3>' + esc(t('clientLinks')) + ' · ' + esc(u.name) + '</h3>' +
        '<p class="hint" style="color:var(--mut);font-size:12px;margin-bottom:12px">' + esc(t('copySubTip')) + '</p>';
      rows.forEach(function (row) {
        html += '<div class="chip-row" style="margin-bottom:8px"><span class="lbl">' + esc(row.l) + '</span>' +
          '<span class="val">' + esc(row.v) + '</span>' +
          '<button class="btn sm" data-copybtn="' + esc(row.v) + '">' + esc(t('copy')) + '</button>' +
          '<button class="btn sm" data-qr="' + esc(row.v) + '">' + esc(t('qr')) + '</button></div>';
      });
      openModal(html);
      wireCopyQr();
    }).catch(function (e) { toast(e.message, 'err'); });
  }

  function wireCopyQr() {
    $all('[data-copybtn]').forEach(function (b) {
      b.addEventListener('click', function () { copyText(b.getAttribute('data-copybtn'), b); });
    });
    $all('[data-qr]').forEach(function (b) {
      b.addEventListener('click', function () { showQr(b.getAttribute('data-qr')); });
    });
  }

  function openAddUser() { openEditUser(null); }

  function openEditUser(u) {
    var isEdit = !!u;
    var quota = u ? (u.quotaBytes / 1073741824) : 0;
    var exp = u && u.expiryAt ? new Date(u.expiryAt).toISOString().slice(0, 10) : '';
    var html = '<button class="btn sm icon close-x" data-close="1">✕</button>' +
      '<h3>' + esc(isEdit ? t('edit') : t('addUser')) + '</h3>' +
      '<div class="field"><label>' + esc(t('name')) + '</label><input type="text" id="m-name" value="' + esc(u ? u.name : '') + '"></div>' +
      '<div class="two-col">' +
      '<div class="field"><label>' + esc(t('quotaGB')) + '</label><input type="number" id="m-quota" min="0" step="any" value="' + quota + '"><div class="hint">' + esc(t('zeroUnlimited')) + '</div></div>' +
      '<div class="field"><label>' + esc(t('expiryDate')) + '</label><input type="date" id="m-exp" value="' + exp + '"><div class="hint">' + esc(t('noExpiry')) + '</div></div>' +
      '</div>' +
      (isEdit ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
        '<button class="btn sm" id="m-reset">' + esc(t('resetUsage')) + '</button>' +
        (u.isAdmin ? '' : '<button class="btn sm" id="m-rotate">' + esc(t('rotateCreds')) + '</button>') + '</div>' : '') +
      '<div style="display:flex;gap:9px;justify-content:flex-end">' +
      '<button class="btn" data-close="1">' + esc(t('cancel')) + '</button>' +
      '<button class="btn primary" id="m-save">' + esc(t('save')) + '</button></div>';
    openModal(html);
    $('#m-save').addEventListener('click', function () {
      var body = {
        name: $('#m-name').value,
        quotaGB: Number($('#m-quota').value || 0),
        expiryAt: $('#m-exp').value ? new Date($('#m-exp').value + 'T23:59:59').getTime() : 0
      };
      var btn = $('#m-save'); btn.disabled = true; btn.textContent = t('saving');
      if (isEdit) {
        api('/users/' + u.id, { method: 'PATCH', body: JSON.stringify(body) })
          .then(function () { closeModal(); loadUsers(); toast(t('saved'), 'ok'); })
          .catch(function (e) { btn.disabled = false; btn.textContent = t('save'); toast(e.message, 'err'); });
      } else {
        api('/users', { method: 'POST', body: JSON.stringify(body) })
          .then(function () { closeModal(); loadUsers(); toast(t('saved'), 'ok'); })
          .catch(function (e) { btn.disabled = false; btn.textContent = t('save'); toast(e.message, 'err'); });
      }
    });
    var rs = $('#m-reset');
    if (rs) rs.addEventListener('click', function () {
      api('/users/' + u.id, { method: 'PATCH', body: JSON.stringify({ resetUsage: true }) })
        .then(function () { closeModal(); loadUsers(); toast(t('saved'), 'ok'); }).catch(function (e) { toast(e.message, 'err'); });
    });
    var ro = $('#m-rotate');
    if (ro) ro.addEventListener('click', function () {
      api('/users/' + u.id, { method: 'PATCH', body: JSON.stringify({ rotateCredentials: true }) })
        .then(function () { closeModal(); loadUsers(); toast(t('saved'), 'ok'); }).catch(function (e) { toast(e.message, 'err'); });
    });
  }

  function confirmDelete(u) {
    var html = '<h3>' + esc(t('confirmDelete')) + '</h3><p style="color:var(--mut);margin-bottom:16px">' + esc(u.name) + '</p>' +
      '<div style="display:flex;gap:9px;justify-content:flex-end">' +
      '<button class="btn" data-close="1">' + esc(t('cancel')) + '</button>' +
      '<button class="btn danger" id="m-del">' + esc(t('delete')) + '</button></div>';
    openModal(html);
    $('#m-del').addEventListener('click', function () {
      api('/users/' + u.id, { method: 'DELETE' })
        .then(function () { closeModal(); loadUsers(); toast(t('saved'), 'ok'); })
        .catch(function (e) { toast(e.message, 'err'); });
    });
  }

  /* ---------------- settings ---------------- */
  function loadSettings() {
    if (GZ.mock) return;
    api('/settings').then(function (s) {
      S.settings = s;
      $('#s-proxyips').value = (s.proxyIPs || []).join('\n');
      $('#s-subpath').value = s.subPath || '';
      $('#s-panelpath').value = s.panelPath || '';
      renderDash();
    }).catch(function () {});
  }

  function saveSettings() {
    var btn = $('#save-settings'); btn.disabled = true; btn.textContent = t('saving');
    var body = {
      proxyIPs: $('#s-proxyips').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean),
      subPath: $('#s-subpath').value.trim(),
      panelPath: $('#s-panelpath').value.trim()
    };
    var pw = $('#s-newpw').value;
    if (pw) body.newPassword = pw;
    var oldPanel = S.settings ? S.settings.panelPath : GZ.panelPath;
    api('/settings', { method: 'POST', body: JSON.stringify(body) }).then(function () {
      toast(t('saved'), 'ok');
      btn.disabled = false; btn.textContent = t('save');
      $('#s-newpw').value = '';
      if (body.panelPath && body.panelPath !== oldPanel) {
        setTimeout(function () { location.href = '/' + body.panelPath; }, 700);
      } else { loadSettings(); }
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = t('save'); toast(e.message, 'err');
    });
  }

  /* ---------------- QR ---------------- */
  function showQr(text) {
    if (window.qrcode) { drawQr(text); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
    s.onload = function () { drawQr(text); };
    s.onerror = function () { toast(t('error'), 'err'); };
    document.head.appendChild(s);
  }
  function drawQr(text) {
    var svg = '';
    try {
      var qr = window.qrcode(0, 'M');
      qr.addData(text); qr.make();
      svg = qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
    } catch (e) { toast(t('error'), 'err'); return; }
    openModal('<button class="btn sm icon close-x" data-close="1">✕</button>' +
      '<div style="background:#fff;padding:14px;border-radius:16px;display:inline-block">' + svg + '</div>');
  }

  /* ---------------- modal ---------------- */
  function openModal(inner) {
    $('#modal-root').innerHTML = '<div class="modal-bg"><div class="modal glass">' + inner + '</div></div>';
    $all('#modal-root [data-close]').forEach(function (b) { b.addEventListener('click', closeModal); });
    $('#modal-root').querySelector('.modal-bg').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) closeModal();
    });
  }
  function closeModal() { $('#modal-root').innerHTML = ''; }

  /* ---------------- mock (offline preview) ---------------- */
  function renderMock() {
    S.status = { version: GZ.version, dbOk: true, isDefaultPassword: true, host: 'gozargah.example.workers.dev' };
    var baseUuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    S.users = [
      { id: 1, name: 'admin', uuid: baseUuid, subToken: 'admin-token-0000000000', quotaBytes: 0, usedUp: 3.2 * 1073741824, usedDown: 41.7 * 1073741824, expiryAt: 0, enabled: true, isAdmin: true, lastSeen: Date.now() - 3600e3 },
      { id: 2, name: 'سارا', uuid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', subToken: 'sara-token-000000000000', quotaBytes: 50 * 1073741824, usedUp: 4.1 * 1073741824, usedDown: 32.9 * 1073741824, expiryAt: Date.now() + 86400e3 * 21, enabled: true, isAdmin: false, lastSeen: Date.now() - 600e3 },
      { id: 3, name: 'reza', uuid: 'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f', subToken: 'reza-token-000000000000', quotaBytes: 20 * 1073741824, usedUp: 0.3 * 1073741824, usedDown: 19.9 * 1073741824, expiryAt: Date.now() + 86400e3 * 5, enabled: true, isAdmin: false, lastSeen: 0 }
    ];
    S.settings = { subPath: 'sub', panelPath: GZ.panelPath, proxyIPs: ['proxyip.cmliussss.net'] };
    S.events = [
      { ts: Date.now() - 600e3, type: 'login_ok', detail: 'panel login' },
      { ts: Date.now() - 3600e3, type: 'user_created', detail: 'سارا' },
      { ts: Date.now() - 7200e3, type: 'conn', detail: 'user=2 up=12MB down=310MB' }
    ];
    $('#ver').textContent = GZ.version;
    showView('main');
    renderDash(); renderUsers(); renderMockEvents();
  }
  function renderMockEvents() {
    $('#ev-list').innerHTML = S.events.map(function (e) {
      return '<div class="ev"><b>' + esc(e.type) + '</b><span>' + esc(e.detail) + '</span><time>' + fmtTime(e.ts) + '</time></div>';
    }).join('');
  }
  function mockLinks(u) {
    var host = 'gozargah.example.workers.dev';
    var ws = '/' + u.uuid + '?ed=2048';
    var p = 'security=tls&sni=' + host + '&fp=chrome&type=ws&host=' + host + '&path=' + encodeURIComponent(ws);
    openLinksFromData({
      links: {
        vless: 'vless://' + u.uuid + '@' + host + ':443?encryption=none&' + p + '#VLESS',
        trojan: 'trojan://' + u.trojanPass + '@' + host + ':443?' + p + '#Trojan'
      },
      subBase: 'https://' + host + '/sub/' + u.subToken,
      subClash: 'https://' + host + '/sub/' + u.subToken + '/clash',
      subSingbox: 'https://' + host + '/sub/' + u.subToken + '/singbox'
    }, u);
  }
  function openLinksFromData(r, u) {
    var rows = [
      { l: 'VLESS', v: r.links.vless }, { l: 'Trojan', v: r.links.trojan },
      { l: t('subBase'), v: r.subBase }, { l: t('subClash'), v: r.subClash }, { l: t('subSingbox'), v: r.subSingbox }
    ];
    var html = '<button class="btn sm icon close-x" data-close="1">✕</button><h3>' + esc(t('clientLinks')) + ' · ' + esc(u.name) + '</h3>';
    rows.forEach(function (row) {
      html += '<div class="chip-row" style="margin-bottom:8px"><span class="lbl">' + esc(row.l) + '</span>' +
        '<span class="val">' + esc(row.v) + '</span>' +
        '<button class="btn sm" data-copybtn="' + esc(row.v) + '">' + esc(t('copy')) + '</button>' +
        '<button class="btn sm" data-qr="' + esc(row.v) + '">' + esc(t('qr')) + '</button></div>';
    });
    openModal(html); wireCopyQr();
  }

  /* ---------------- wiring ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    boot();

    $('#lang-btn').addEventListener('click', function () {
      S.lang = S.lang === 'fa' ? 'en' : 'fa';
      localStorage.setItem('gz_lang', S.lang);
      applyI18n(); renderDash(); renderUsers();
      if (GZ.mock) renderMockEvents(); else loadEvents();
    });

    $('#login-btn').addEventListener('click', doLogin);
    $('#login-pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    function doLogin() {
      var err = $('#login-err'); err.textContent = '';
      var btn = $('#login-btn'); btn.disabled = true;
      api('/login', { method: 'POST', body: JSON.stringify({ password: $('#login-pw').value }) })
        .then(function () { btn.disabled = false; showView('main'); loadAll(); toast(t('saved'), 'ok'); })
        .catch(function (e) {
          btn.disabled = false;
          err.textContent = e.message === 'too_many_attempts' ? t('tooManyAttempts') : (e.message === 'bad_password' ? t('wrongPassword') : e.message);
        });
    }

    $('#logout-btn').addEventListener('click', function () {
      api('/logout', { method: 'POST' }).then(function () { showView('login'); });
    });

    $('#setup-retry').addEventListener('click', function () { location.reload(); });

    $all('.tab').forEach(function (b) {
      b.addEventListener('click', function () {
        $all('.tab').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        var tab = b.getAttribute('data-tab');
        $('#tab-dash').classList.toggle('hidden', tab !== 'dash');
        $('#tab-users').classList.toggle('hidden', tab !== 'users');
        $('#tab-set').classList.toggle('hidden', tab !== 'set');
      });
    });

    $('#pw-warn-go').addEventListener('click', function () {
      $all('.tab').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-tab') === 'set'); });
      $('#tab-dash').classList.add('hidden'); $('#tab-users').classList.add('hidden'); $('#tab-set').classList.remove('hidden');
      $('#s-newpw').focus();
    });

    $('#admin-sub-copy').addEventListener('click', function () {
      var v = $('#admin-sub').getAttribute('data-copy') || $('#admin-sub').textContent;
      copyText(v, $('#admin-sub-copy'));
    });

    $('#add-user-btn').addEventListener('click', openAddUser);
    $('#save-settings').addEventListener('click', saveSettings);
  });
})();
`;

// src/panel/i18n.ts
var FA = {
  appName: "\u06AF\u0630\u0631\u06AF\u0627\u0647",
  tagline: "\u062F\u0631\u0648\u0627\u0632\u0647\u0654 \u0627\u0645\u0646 \u0639\u0628\u0648\u0631",
  login: "\u0648\u0631\u0648\u062F \u0628\u0647 \u067E\u0646\u0644",
  password: "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631",
  enter: "\u0648\u0631\u0648\u062F",
  logout: "\u062E\u0631\u0648\u062C",
  wrongPassword: "\u0631\u0645\u0632 \u0627\u0634\u062A\u0628\u0627\u0647 \u0627\u0633\u062A",
  tooManyAttempts: "\u062A\u0644\u0627\u0634 \u0632\u06CC\u0627\u062F \u2014 \u06A9\u0645\u06CC \u0635\u0628\u0631 \u06A9\u0646\u06CC\u062F",
  dashboard: "\u062F\u0627\u0634\u0628\u0648\u0631\u062F",
  usersTab: "\u06A9\u0627\u0631\u0628\u0631\u0627\u0646",
  settingsTab: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A",
  add: "\u0627\u0641\u0632\u0648\u062F\u0646",
  save: "\u0630\u062E\u06CC\u0631\u0647",
  saving: "\u062F\u0631 \u062D\u0627\u0644 \u0630\u062E\u06CC\u0631\u0647\u2026",
  cancel: "\u0627\u0646\u0635\u0631\u0627\u0641",
  delete: "\u062D\u0630\u0641",
  edit: "\u0648\u06CC\u0631\u0627\u06CC\u0634",
  copy: "\u06A9\u067E\u06CC",
  copied: "\u06A9\u067E\u06CC \u0634\u062F \u2713",
  qr: "QR",
  close: "\u0628\u0633\u062A\u0646",
  version: "\u0646\u0633\u062E\u0647",
  host: "\u0647\u0627\u0633\u062A",
  database: "\u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 D1",
  connected: "\u0645\u062A\u0635\u0644",
  notConnected: "\u0645\u062A\u0635\u0644 \u0646\u06CC\u0633\u062A",
  defaultPwWarn: "\u0631\u0645\u0632 \u067E\u06CC\u0634\u200C\u0641\u0631\u0636 (admin) \u0647\u0646\u0648\u0632 \u0641\u0639\u0627\u0644 \u0627\u0633\u062A \u2014 \u0647\u0645\u06CC\u0646 \u062D\u0627\u0644\u0627 \u062A\u063A\u06CC\u06CC\u0631\u0634 \u062F\u0647\u06CC\u062F.",
  changePw: "\u062A\u063A\u06CC\u06CC\u0631 \u0631\u0645\u0632",
  usersCount: "\u062A\u0639\u062F\u0627\u062F \u06A9\u0627\u0631\u0628\u0631\u0627\u0646",
  realBytes: "\u062D\u0633\u0627\u0628\u062F\u0627\u0631\u06CC \u0628\u0627\u06CC\u062A \u0648\u0627\u0642\u0639\u06CC",
  usage: "\u0645\u0635\u0631\u0641",
  unlimited: "\u0646\u0627\u0645\u062D\u062F\u0648\u062F",
  expired: "\u0645\u0646\u0642\u0636\u06CC",
  disabled: "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644",
  active: "\u0641\u0639\u0627\u0644",
  quotaReached: "\u0633\u0647\u0645\u06CC\u0647 \u067E\u0631 \u0634\u062F",
  expiry: "\u0627\u0646\u0642\u0636\u0627",
  never: "\u0628\u062F\u0648\u0646 \u0627\u0646\u0642\u0636\u0627",
  quota: "\u0633\u0647\u0645\u06CC\u0647",
  name: "\u0646\u0627\u0645",
  quotaGB: "\u0633\u0647\u0645\u06CC\u0647 (\u06AF\u06CC\u06AF\u0627\u0628\u0627\u06CC\u062A)",
  zeroUnlimited: "\u06F0 = \u0646\u0627\u0645\u062D\u062F\u0648\u062F",
  expiryDate: "\u062A\u0627\u0631\u06CC\u062E \u0627\u0646\u0642\u0636\u0627",
  noExpiry: "\u0628\u062F\u0648\u0646 \u0627\u0646\u0642\u0636\u0627",
  actions: "\u0639\u0645\u0644\u06CC\u0627\u062A",
  clientLinks: "\u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627\u06CC \u06A9\u0644\u0627\u06CC\u0646\u062A",
  subscriptionLinks: "\u0644\u06CC\u0646\u06A9\u200C\u0647\u0627\u06CC \u0627\u0634\u062A\u0631\u0627\u06A9",
  subBase: "\u0627\u0634\u062A\u0631\u0627\u06A9 (Base64)",
  subClash: "\u0627\u0634\u062A\u0631\u0627\u06A9 (Clash)",
  subSingbox: "\u0627\u0634\u062A\u0631\u0627\u06A9 (Sing-box)",
  proxyIPs: "ProxyIP \u0647\u0627 (\u0647\u0631 \u062E\u0637 \u06CC\u06A9 \u0645\u0648\u0631\u062F)",
  proxyIPsHint: "\u0628\u0631\u0627\u06CC \u0633\u0627\u06CC\u062A\u200C\u0647\u0627\u06CC \u067E\u0634\u062A \u06A9\u0644\u0627\u062F\u0641\u0644\u0631 \u0644\u0627\u0632\u0645 \u0627\u0633\u062A\u061B \u0627\u0648\u0644 \u06CC\u06A9 IP \u067E\u0627\u06CC\u062F\u0627\u0631 \u0628\u0631\u0627\u06CC \u0647\u0631 \u06A9\u0627\u0631\u0628\u0631 \u0627\u0646\u062A\u062E\u0627\u0628 \u0645\u06CC\u200C\u0634\u0648\u062F.",
  subPath: "\u0645\u0633\u06CC\u0631 \u0627\u0634\u062A\u0631\u0627\u06A9",
  panelPath: "\u0645\u0633\u06CC\u0631 \u067E\u0646\u0644",
  panelPathHint: "\u0628\u0639\u062F \u0627\u0632 \u062A\u063A\u06CC\u06CC\u0631\u060C \u0628\u0647 \u0622\u062F\u0631\u0633 \u062C\u062F\u06CC\u062F \u0645\u0646\u062A\u0642\u0644 \u0645\u06CC\u200C\u0634\u0648\u06CC\u062F.",
  newPassword: "\u0631\u0645\u0632 \u062C\u062F\u06CC\u062F (\u062D\u062F\u0627\u0642\u0644 \u06F8 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631)",
  leaveBlankKeep: "\u062E\u0627\u0644\u06CC \u0628\u06AF\u0630\u0627\u0631\u06CC\u062F \u062A\u0627 \u062A\u063A\u06CC\u06CC\u0631 \u0646\u06A9\u0646\u062F",
  noUsers: "\u0647\u0646\u0648\u0632 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0646\u0633\u0627\u062E\u062A\u0647\u200C\u0627\u06CC\u062F.",
  addUser: "\u06A9\u0627\u0631\u0628\u0631 \u062C\u062F\u06CC\u062F",
  confirmDelete: "\u0627\u06CC\u0646 \u06A9\u0627\u0631\u0628\u0631 \u062D\u0630\u0641 \u0634\u0648\u062F\u061F",
  resetUsage: "\u0635\u0641\u0631 \u06A9\u0631\u062F\u0646 \u0645\u0635\u0631\u0641",
  rotateCreds: "\u0686\u0631\u062E\u0634 \u0627\u0639\u062A\u0628\u0627\u0631\u0647\u0627 (UUID/\u0631\u0645\u0632 \u062A\u0631\u0648\u062C\u0627\u0646)",
  saved: "\u0630\u062E\u06CC\u0631\u0647 \u0634\u062F \u2713",
  error: "\u062E\u0637\u0627",
  events: "\u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627\u06CC \u0627\u062E\u06CC\u0631",
  noEvents: "\u0631\u0648\u06CC\u062F\u0627\u062F\u06CC \u0646\u06CC\u0633\u062A.",
  setupTitle: "\u0627\u062A\u0635\u0627\u0644 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 D1",
  setupDesc: "\u067E\u0646\u0644 \u0628\u062F\u0648\u0646 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u06A9\u0627\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648\u0644\u06CC \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0648 \u06A9\u0627\u0631\u0628\u0631\u0627\u0646 \u0630\u062E\u06CC\u0631\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F. \u0628\u0627 \u06F4 \u0642\u062F\u0645 \u0632\u06CC\u0631 \u0648\u0635\u0644 \u06A9\u0646\u06CC\u062F:",
  setupStep1: "\u062F\u0631 \u062F\u0627\u0634\u0628\u0648\u0631\u062F Cloudflare \u0628\u0647 Workers & Pages \u2190 D1 \u0628\u0631\u0648\u06CC\u062F \u0648 Create \u0628\u0632\u0646\u06CC\u062F\u061B \u0646\u0627\u0645: gozargah",
  setupStep2: "\u0648\u0627\u0631\u062F Worker \u062E\u0648\u062F \u0634\u0648\u06CC\u062F (\u06AF\u0630\u0631\u06AF\u0627\u0647) \u2190 Settings \u2190 Bindings \u2190 Add",
  setupStep3: "\u0646\u0648\u0639 D1 Database \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u06CC\u062F\u061B Variable name \u062F\u0642\u06CC\u0642\u0627\u064B: GZ_DB \u0648 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 gozargah \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u06CC\u062F",
  setupStep4: "Save \u0648 Deploy \u0628\u0632\u0646\u06CC\u062F \u2014 \u0635\u0641\u062D\u0647 \u0631\u0627 \u062F\u0648\u0628\u0627\u0631\u0647 \u0628\u0627\u0632 \u06A9\u0646\u06CC\u062F.",
  retry: "\u0628\u0631\u0631\u0633\u06CC \u0645\u062C\u062F\u062F",
  adminBadge: "\u0627\u062F\u0645\u06CC\u0646",
  seen: "\u0622\u062E\u0631\u06CC\u0646 \u0641\u0639\u0627\u0644\u06CC\u062A",
  quickSub: "\u0627\u0634\u062A\u0631\u0627\u06A9 \u0633\u0631\u06CC\u0639 (\u0627\u062F\u0645\u06CC\u0646)",
  used: "\u0645\u0635\u0631\u0641\u200C\u0634\u062F\u0647",
  left: "\u0628\u0627\u0642\u06CC\u200C\u0645\u0627\u0646\u062F\u0647",
  of: "\u0627\u0632",
  neverSeen: "\u0647\u0646\u0648\u0632 \u0645\u062A\u0635\u0644 \u0646\u0634\u062F\u0647",
  statsNote: "\u0634\u0645\u0627\u0631\u0634 \u0627\u0632 \u0622\u062E\u0631\u06CC\u0646 \u0628\u06CC\u062F\u0627\u0631\u06CC Worker \u2014 \u062F\u0642\u06CC\u0642 \u0648 \u0628\u0631 \u0627\u0633\u0627\u0633 \u0628\u0627\u06CC\u062A \u0648\u0627\u0642\u0639\u06CC.",
  lang: "English",
  panelLink: "\u0622\u062F\u0631\u0633 \u067E\u0646\u0644",
  copySubTip: "\u0627\u06CC\u0646 \u0644\u06CC\u0646\u06A9 \u0631\u0627 \u062F\u0631 \u06A9\u0644\u0627\u06CC\u0646\u062A (v2rayNG\u060C Streisand\u060C Hiddify \u0648\u2026) \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F."
};
var EN = {
  appName: "Gozargah",
  tagline: "Secure passage gateway",
  login: "Panel Login",
  password: "Password",
  enter: "Sign in",
  logout: "Log out",
  wrongPassword: "Wrong password",
  tooManyAttempts: "Too many attempts \u2014 wait a bit",
  dashboard: "Dashboard",
  usersTab: "Users",
  settingsTab: "Settings",
  add: "Add",
  save: "Save",
  saving: "Saving\u2026",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  copy: "Copy",
  copied: "Copied \u2713",
  qr: "QR",
  close: "Close",
  version: "Version",
  host: "Host",
  database: "D1 Database",
  connected: "Connected",
  notConnected: "Not connected",
  defaultPwWarn: "Default password (admin) is still active \u2014 change it now.",
  changePw: "Change password",
  usersCount: "Users",
  realBytes: "Real byte accounting",
  usage: "Usage",
  unlimited: "Unlimited",
  expired: "Expired",
  disabled: "Disabled",
  active: "Active",
  quotaReached: "Quota reached",
  expiry: "Expiry",
  never: "Never expires",
  quota: "Quota",
  name: "Name",
  quotaGB: "Quota (GB)",
  zeroUnlimited: "0 = unlimited",
  expiryDate: "Expiry date",
  noExpiry: "No expiry",
  actions: "Actions",
  clientLinks: "Client configs",
  subscriptionLinks: "Subscription links",
  subBase: "Subscription (Base64)",
  subClash: "Subscription (Clash)",
  subSingbox: "Subscription (Sing-box)",
  proxyIPs: "ProxyIPs (one per line)",
  proxyIPsHint: "Required for Cloudflare-fronted targets; a stable IP is picked per user.",
  subPath: "Subscription path",
  panelPath: "Panel path",
  panelPathHint: "You will be redirected to the new address after saving.",
  newPassword: "New password (min 8 chars)",
  leaveBlankKeep: "Leave blank to keep current",
  noUsers: "No users yet.",
  addUser: "New user",
  confirmDelete: "Delete this user?",
  resetUsage: "Reset usage",
  rotateCreds: "Rotate credentials (UUID/Trojan pass)",
  saved: "Saved \u2713",
  error: "Error",
  events: "Recent events",
  noEvents: "No events yet.",
  setupTitle: "Connect the D1 database",
  setupDesc: "The panel works without a database but cannot persist users/settings. Connect it in 4 steps:",
  setupStep1: "In the Cloudflare dashboard go to Workers & Pages \u2192 D1 \u2192 Create; name it gozargah",
  setupStep2: "Open your Worker (gozargah) \u2192 Settings \u2192 Bindings \u2192 Add",
  setupStep3: "Pick D1 Database; Variable name must be exactly: GZ_DB, and select the gozargah database",
  setupStep4: "Save and Deploy \u2014 reload this page.",
  retry: "Re-check",
  adminBadge: "admin",
  seen: "Last seen",
  quickSub: "Quick subscription (admin)",
  used: "Used",
  left: "Remaining",
  of: "of",
  neverSeen: "Never connected",
  statsNote: "Counted since last worker wake \u2014 real bytes, honestly measured.",
  lang: "\u0641\u0627\u0631\u0633\u06CC",
  panelLink: "Panel URL",
  copySubTip: "Paste this link into your client (v2rayNG, Streisand, Hiddify, \u2026)."
};
var DICTS = { fa: FA, en: EN };

// src/panel/page.ts
function emblemSvg(cls, uid = "g") {
  const gid = "gza-" + uid;
  return '<div class="emblem ' + cls + '"><svg viewBox="0 0 120 104" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="' + gid + '" x1="18" y1="96" x2="102" y2="8" gradientUnits="userSpaceOnUse"><stop stop-color="#2CC9FF"/><stop offset=".52" stop-color="#8B5CF6"/><stop offset="1" stop-color="#C026D3"/></linearGradient></defs><path class="draw" d="M18,94 V54 C18,26 37,11 60,9 C83,11 102,26 102,54 V94" stroke="url(#' + gid + ')" stroke-width="3.2" stroke-linecap="round"/><path d="M34,94 V58 C34,39 45,28 60,26 C75,28 86,39 86,58 V94" stroke="url(#' + gid + ')" stroke-width="1.6" opacity=".4" stroke-linecap="round"/><path d="M10,94 H110" stroke="rgba(255,255,255,.28)" stroke-width="2.4" stroke-linecap="round"/><circle cx="60" cy="9" r="2.6" fill="#C026D3"/><circle r="2.4" fill="#2CC9FF"><animateMotion dur="7s" repeatCount="indefinite" path="M18,94 V54 C18,26 37,11 60,9 C83,11 102,26 102,54 V94"/></circle></svg></div>';
}
__name(emblemSvg, "emblemSvg");
function panelBody(gz) {
  const gzJson = JSON.stringify(gz).replace(/<\//g, "<\\/");
  return `
<div class="gz-bg"></div>
<header class="topbar">
  <div class="topbar-in">
    <div class="brand">
      <img src="" alt="Gozargah" id="brand-logo">
      <div><b data-i18n="appName">\u06AF\u0630\u0631\u06AF\u0627\u0647</b><small>Gozargah Panel \xB7 <span id="ver">\u2014</span></small></div>
    </div>
    <div class="top-actions">
      <span class="vchip" id="db-chip"></span>
      <button class="btn sm ghost" id="lang-btn" type="button">English</button>
      <button class="btn sm ghost hidden" id="logout-btn" type="button" data-i18n="logout">\u062E\u0631\u0648\u062C</button>
    </div>
  </div>
</header>
<main class="wrap">

  <!-- login -->
  <section id="v-login" class="auth-wrap">
    <div class="auth-card glass">
      ${emblemSvg("", "login")}
      <h2 data-i18n="appName">\u06AF\u0630\u0631\u06AF\u0627\u0647</h2>
      <p data-i18n="tagline">\u062F\u0631\u0648\u0627\u0632\u0647\u0654 \u0627\u0645\u0646 \u0639\u0628\u0648\u0631</p>
      <div class="auth-err" id="login-err"></div>
      <div class="field">
        <input type="password" id="login-pw" autocomplete="current-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022">
      </div>
      <button class="btn primary" id="login-btn" type="button" style="width:100%" data-i18n="enter">\u0648\u0631\u0648\u062F</button>
    </div>
  </section>

  <!-- setup guide (no D1) -->
  <section id="v-setup" class="hidden" style="padding-top:34px">
    <div class="glass" style="padding:28px">
      <h2 class="gradtext" style="font-size:19px;font-weight:800;margin-bottom:6px" data-i18n="setupTitle">\u0627\u062A\u0635\u0627\u0644 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 D1</h2>
      <p style="color:var(--mut);font-size:13px" data-i18n="setupDesc"></p>
      <ol class="steps">
        <li data-i18n="setupStep1"></li>
        <li data-i18n="setupStep2"></li>
        <li data-i18n="setupStep3"></li>
        <li data-i18n="setupStep4"></li>
      </ol>
      <button class="btn primary" id="setup-retry" type="button" data-i18n="retry">\u0628\u0631\u0631\u0633\u06CC \u0645\u062C\u062F\u062F</button>
    </div>
  </section>

  <!-- main -->
  <section id="v-main" class="hidden">
    <div class="hero glass">
      ${emblemSvg("", "hero")}
      <div>
        <h1><span data-i18n="appName">\u06AF\u0630\u0631\u06AF\u0627\u0647</span> <span class="gradtext" id="hero-ver"></span></h1>
        <p data-i18n="statsNote"></p>
      </div>
      <div class="sub-chip">
        <div class="chip-row"><span class="lbl" data-i18n="quickSub"></span></div>
        <div class="chip-row" style="margin-top:7px"><span class="val" id="admin-sub">\u2014</span>
          <button class="btn sm" id="admin-sub-copy" type="button" data-i18n="copy">\u06A9\u067E\u06CC</button></div>
      </div>
    </div>

    <div class="warnbox hidden" id="pw-warn">
      <span>\u26A0\uFE0F</span><span data-i18n="defaultPwWarn"></span>
      <button class="btn sm" id="pw-warn-go" type="button" data-i18n="changePw"></button>
    </div>

    <nav class="tabs">
      <button class="tab on" data-tab="dash" type="button" data-i18n="dashboard">\u062F\u0627\u0634\u0628\u0648\u0631\u062F</button>
      <button class="tab" data-tab="users" type="button" data-i18n="usersTab">\u06A9\u0627\u0631\u0628\u0631\u0627\u0646</button>
      <button class="tab" data-tab="set" type="button" data-i18n="settingsTab">\u062A\u0646\u0638\u06CC\u0645\u0627\u062A</button>
    </nav>

    <!-- dashboard -->
    <div id="tab-dash">
      <div class="stat-grid" id="stat-grid"></div>
      <div class="events glass" style="padding:18px 20px">
        <h4 data-i18n="events"></h4>
        <div id="ev-list"><div class="ev" data-i18n="noEvents"></div></div>
      </div>
    </div>

    <!-- users -->
    <div id="tab-users" class="hidden">
      <div class="users-head">
        <h3 data-i18n="usersTab"></h3>
        <button class="btn primary sm" id="add-user-btn" type="button" data-i18n="addUser"></button>
      </div>
      <div class="user-grid" id="user-grid"></div>
    </div>

    <!-- settings -->
    <div id="tab-set" class="hidden">
      <div class="glass" style="padding:26px">
        <div class="field">
          <label data-i18n="proxyIPs"></label>
          <textarea id="s-proxyips" rows="3"></textarea>
          <div class="hint" data-i18n="proxyIPsHint"></div>
        </div>
        <div class="two-col">
          <div class="field">
            <label data-i18n="subPath"></label>
            <input type="text" id="s-subpath" class="mono">
          </div>
          <div class="field">
            <label data-i18n="panelPath"></label>
            <input type="text" id="s-panelpath" class="mono">
            <div class="hint" data-i18n="panelPathHint"></div>
          </div>
        </div>
        <div class="field">
          <label data-i18n="newPassword"></label>
          <input type="password" id="s-newpw" autocomplete="new-password">
          <div class="hint" data-i18n="leaveBlankKeep"></div>
        </div>
        <button class="btn primary" id="save-settings" type="button" data-i18n="save"></button>
      </div>
    </div>
  </section>
</main>
<div id="modal-root"></div>
<div id="toasts"></div>
<script>window.__GZ_DICT__ = ${JSON.stringify(DICTS).replace(/<\//g, "<\\/")}; window.__GZ__ = ${gzJson};<\/script>
<script>
${PANEL_JS}
<\/script>`;
}
__name(panelBody, "panelBody");

// src/assets/logo.ts
var LOGO_BRAND_B64 = "data:image/webp;base64,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";
var LOGO_FAV_B64 = "data:image/png;base64,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";

// src/panel/ui.ts
init_config();
function panelHtml(d) {
  const version = d.version ?? VERSION;
  const body = panelBody({
    panelPath: d.panelPath,
    dbOk: d.dbOk,
    isDefaultPassword: d.isDefaultPassword,
    version,
    lang: d.lang ?? "fa",
    mock: d.mock,
    logo: LOGO_BRAND_B64,
    favicon: LOGO_FAV_B64
  });
  return '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex, nofollow"><title>Gozargah \xB7 \u06AF\u0630\u0631\u06AF\u0627\u0647</title><link rel="icon" href="' + LOGO_FAV_B64 + '"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"><style>' + PANEL_CSS + "</style></head><body>" + body + "</body></html>";
}
__name(panelHtml, "panelHtml");

// src/panel/landing.ts
init_config();
function landingHtml(lang) {
  const fa = lang !== "en";
  const title = fa ? "\u06AF\u0630\u0631\u06AF\u0627\u0647" : "Gozargah";
  const line1 = fa ? "\u0647\u0631 \u0645\u0633\u06CC\u0631\u06CC\u060C \u0627\u0632 \u06CC\u06A9 \u06AF\u0630\u0631\u06AF\u0627\u0647 \u0645\u06CC\u200C\u06AF\u0630\u0631\u062F." : "Every road passes through a gateway.";
  const line2 = fa ? "\u0633\u062F\u06CC\u060C \u067E\u06CC\u0634 \u0627\u0632 \u0622\u0628\u0650 \u0631\u0648\u0627\u0646 \u0646\u0627\u06CC\u0633\u062A\u062F." : "A dam cannot hold flowing water forever.";
  return '<!DOCTYPE html><html lang="' + (fa ? "fa" : "en") + '" dir="' + (fa ? "rtl" : "ltr") + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>' + title + '</title><link rel="icon" href="' + LOGO_FAV_B64 + '"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"><style>' + PANEL_CSS + '.land{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;gap:6px}.land .emblem{width:130px;margin-bottom:10px}.land h1{font-size:34px;font-weight:800}.land p{color:var(--mut);font-size:15px;max-width:420px}.land .p2{font-size:13px;color:var(--mut2);font-style:italic}.land footer{position:absolute;bottom:18px;font-size:11px;color:var(--mut2)}</style></head><body><div class="gz-bg"></div><div class="land">' + emblemSvg("", "land") + '<h1 class="gradtext">' + title + "</h1><p>" + line1 + '</p><p class="p2">\xAB' + line2 + "\xBB</p><footer>Gozargah \xB7 v" + VERSION + "</footer></div></body></html>";
}
__name(landingHtml, "landingHtml");

// src/index.ts
var src_default = {
  async fetch(request, env, ctx) {
    try {
      return await route(request, env, ctx);
    } catch (e) {
      glog("router error: " + (e instanceof Error ? e.message : String(e)));
      return new Response(landingHtml("fa"), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
      });
    }
  }
};
async function route(request, env, ctx) {
  const url = new URL(request.url);
  if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
    return acceptWebSocket(request, env, ctx);
  }
  const rawPath = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, "");
  const host = url.host;
  if (rawPath === "favicon.ico" || rawPath === "favicon.png") {
    const bytes = atob(LOGO_FAV_B64.split(",")[1]);
    const buf = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++)
      buf[i] = bytes.charCodeAt(i);
    return new Response(buf, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
  }
  if (rawPath === "robots.txt") {
    return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain" } });
  }
  if (rawPath === "healthz") {
    return new Response(JSON.stringify({ ok: true, version: VERSION }), {
      headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  }
  const eff = await getEffectiveSettings(env, host);
  if (rawPath === eff.panelPath) {
    const html = panelHtml({
      panelPath: eff.panelPath,
      dbOk: eff.dbOk,
      isDefaultPassword: eff.isDefaultPassword,
      version: VERSION,
      lang: "fa"
    });
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
    });
  }
  if (rawPath.startsWith(eff.panelPath + "/api/")) {
    const action = rawPath.slice(eff.panelPath.length + 5);
    return handlePanelApi(request, env, eff, action);
  }
  if (rawPath.startsWith(eff.subPath + "/") && env.GZ_DB) {
    const segs = rawPath.slice(eff.subPath.length + 1).split("/").filter(Boolean);
    const token = segs[0] ?? "";
    const appOverride = (segs[1] ?? url.searchParams.get("app") ?? "").toLowerCase();
    const user = await findUserByToken(env.GZ_DB, url.hostname, token);
    if (user) {
      const app = appOverride === "clash" || appOverride === "singbox" || appOverride === "v2ray" ? appOverride : sniffApp(request.headers.get("user-agent") ?? "");
      const { body } = renderSub(app, url.hostname, user);
      return new Response(body, { headers: subHeaders(eff, url.hostname, user, app) });
    }
  }
  return new Response(landingHtml("fa"), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}
__name(route, "route");
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
