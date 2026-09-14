/**
 * Gozargah — authenticated panel JSON API.
 * All routes live under /{panelPath}/api/* and require an HMAC session
 * cookie except /login (throttled) and /status (used to detect auth state).
 */

import { Env, GzError, VERSION } from '../config';
import { EffectiveSettings } from '../settings';
import {
  addEvent, recentEvents, saveSettings, SettingsBlob, loadSettings, invalidateCache,
} from '../db/store';
import {
  createUser, deleteUser, GzUser, invalidateUsers, listUsers, updateUser, flushUsage,
} from '../db/users';
import {
  checkLoginGate, clearedCookie, ipHash, isAuthed, makeSessionToken, onLoginResult,
  requireAuth, sessionCookie, verifyPanelPassword,
} from '../auth';
import { buildLinks, subTokenFor } from '../subscription';
import { logRing } from '../utils/log';
import { pbkdf2Hex, randomHex } from '../utils/crypto';

const JSON_CT = 'application/json; charset=utf-8';

function json(data: unknown, status = 200, extraHeaders?: Headers): Response {
  const h = extraHeaders ?? new Headers();
  h.set('content-type', JSON_CT);
  h.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers: h });
}

function publicUser(u: GzUser): Record<string, unknown> {
  return {
    id: u.id, name: u.name, uuid: u.uuid, trojanPass: u.trojanPass,
    quotaBytes: u.quotaBytes, usedUp: u.usedUp, usedDown: u.usedDown,
    expiryAt: u.expiryAt, enabled: u.enabled, isAdmin: u.isAdmin,
    createdAt: u.createdAt, lastSeen: u.lastSeen,
  };
}

export async function handlePanelApi(
  request: Request,
  env: Env,
  eff: EffectiveSettings,
  action: string,
): Promise<Response> {
  const method = request.method;
  const db = env.GZ_DB;

  try {
    /* ---------------- public ---------------- */

    if (action === 'status' && method === 'GET') {
      return json({
        version: VERSION,
        dbOk: eff.dbOk,
        isDefaultPassword: eff.isDefaultPassword,
        host: new URL(request.url).hostname,
        logs: logRing.slice(-12),
      });
    }

    if (action === 'login' && method === 'POST') {
      const gate = await checkLoginGate(env, request);
      if (!gate.allowed) {
        await addEvent(db!, 'login_blocked', 'rate limit reached');
        return json({ error: 'too_many_attempts', attemptsLeft: 0 }, 429);
      }
      const body = (await request.json().catch(() => ({}))) as { password?: string };
      const ok = await verifyPanelPassword(eff, String(body.password ?? ''));
      await onLoginResult(env, request, ok);
      if (!ok) {
        if (db) await addEvent(db, 'login_failed', 'bad password');
        return json({ error: 'bad_password', attemptsLeft: gate.attemptsLeft - 1 }, 401);
      }
      if (db) await addEvent(db, 'login_ok', 'panel login');
      const token = await makeSessionToken(eff);
      return json({ ok: true }, 200, new Headers({ 'set-cookie': sessionCookie(token) }));
    }

    /* ---------------- authenticated ---------------- */

    if (action === 'logout' && method === 'POST') {
      return json({ ok: true }, 200, new Headers({ 'set-cookie': clearedCookie() }));
    }

    await requireAuth(request, eff);

    if (action === 'me' && method === 'GET') {
      return json({ ok: true, version: VERSION, dbOk: eff.dbOk, isDefaultPassword: eff.isDefaultPassword });
    }

    if (action === 'settings' && method === 'GET') {
      const s = db ? await loadSettings(db) : null;
      return json({
        panelPath: s?.panelPath ?? eff.panelPath,
        subPath: s?.subPath ?? eff.subPath,
        proxyIPs: s?.proxyIPs ?? eff.proxyIPs,
        isDefaultPassword: s?.isDefaultPassword ?? eff.isDefaultPassword,
        dbOk: eff.dbOk,
      });
    }

    if (action === 'settings' && method === 'POST') {
      if (!db) throw new GzError('database_not_bound', 'no_db');
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

      const next = await saveSettings(db, (prev) => {
        const cur: SettingsBlob = prev ?? {
          schemaVersion: 1, panelPath: eff.panelPath, subPath: eff.subPath,
          proxyIPs: eff.proxyIPs, passwordSalt: eff.passwordSalt, passwordHash: eff.passwordHash,
          pwIterations: eff.pwIterations, isDefaultPassword: eff.isDefaultPassword, createdAt: Date.now(),
        };
        const out: SettingsBlob = { ...cur };

        if (typeof body.panelPath === 'string') {
          const v = body.panelPath.trim().toLowerCase();
          if (!/^[a-z0-9][a-z0-9-]{2,31}$/.test(v)) throw new GzError('invalid panelPath', 'validation');
          out.panelPath = v;
        }
        if (typeof body.subPath === 'string') {
          const v = body.subPath.trim().toLowerCase();
          if (!/^[a-z0-9][a-z0-9-]{2,31}$/.test(v)) throw new GzError('invalid subPath', 'validation');
          out.subPath = v;
        }
        if (Array.isArray(body.proxyIPs)) {
          const ips = (body.proxyIPs as unknown[])
            .map((x) => String(x).trim())
            .filter((x) => /^[a-z0-9.\-:]+$/i.test(x) && x.length <= 253);
          if (ips.length > 32) throw new GzError('too many proxyIPs', 'validation');
          out.proxyIPs = ips.length ? ips : ['proxyip.cmliussss.net'];
        }
        if (typeof body.newPassword === 'string' && body.newPassword.length > 0) {
          const pw = body.newPassword;
          if (pw.length < 8) throw new GzError('password too short (min 8)', 'validation');
          out.passwordSalt = randomHex(16);
          out.pwIterations = eff.pwIterations;
          // hash computed outside (async) — handled below
          (out as SettingsBlob & { __newPw?: string }).__newPw = pw;
        }
        return out;
      });

      // password hashing needs async — apply post-write if requested
      const marker = next as SettingsBlob & { __newPw?: string };
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
        await addEvent(db, 'password_changed', 'panel password updated');
      }
      invalidateCache();
      return json({ ok: true });
    }

    if (action === 'users' && method === 'GET') {
      if (!db) throw new GzError('database_not_bound', 'no_db');
      const users = await listUsers(db);
      const withTokens = [] as Array<Record<string, unknown>>;
      const host = new URL(request.url).hostname;
      for (const u of users) {
        withTokens.push({ ...publicUser(u), subToken: await subTokenFor(host, u.uuid) });
      }
      return json({ users: withTokens });
    }

    if (action === 'users' && method === 'POST') {
      if (!db) throw new GzError('database_not_bound', 'no_db');
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const name = String(body.name ?? '').trim().slice(0, 32);
      if (!/^[\w\u0600-\u06FF .-]{1,32}$/.test(name)) throw new GzError('invalid name', 'validation');
      const quotaGB = Number(body.quotaGB ?? 0);
      if (!Number.isFinite(quotaGB) || quotaGB < 0 || quotaGB > 1024 * 100) throw new GzError('invalid quotaGB', 'validation');
      const expiryAt = Number(body.expiryAt ?? 0);
      if (!Number.isFinite(expiryAt) || expiryAt < 0) throw new GzError('invalid expiryAt', 'validation');
      const u = await createUser(db, { name, quotaBytes: Math.round(quotaGB * 1024 ** 3), expiryAt });
      await addEvent(db, 'user_created', name);
      return json({ user: publicUser(u) }, 201);
    }

    const userMatch = action.match(/^users\/(\d+)$/);
    if (userMatch) {
      if (!db) throw new GzError('database_not_bound', 'no_db');
      const id = Number(userMatch[1]);
      if (method === 'PATCH') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const patch: Record<string, unknown> = {};
        if (typeof body.name === 'string') {
          const n = body.name.trim().slice(0, 32);
          if (!/^[\w\u0600-\u06FF .-]{1,32}$/.test(n)) throw new GzError('invalid name', 'validation');
          patch.name = n;
        }
        if (body.quotaGB !== undefined) {
          const q = Number(body.quotaGB);
          if (!Number.isFinite(q) || q < 0) throw new GzError('invalid quotaGB', 'validation');
          patch.quotaBytes = Math.round(q * 1024 ** 3);
        }
        if (body.expiryAt !== undefined) {
          const x = Number(body.expiryAt);
          if (!Number.isFinite(x) || x < 0) throw new GzError('invalid expiryAt', 'validation');
          patch.expiryAt = x;
        }
        if (body.enabled !== undefined) patch.enabled = !!body.enabled;
        if (body.resetUsage === true) { patch.usedUp = 0; patch.usedDown = 0; }
        if (body.rotateCredentials === true) {
          const u = (await listUsers(db)).find((x) => x.id === id);
          if (u?.isAdmin) throw new GzError('cannot rotate admin credentials (reset D1 instead)', 'validation');
          patch.uuid = crypto.randomUUID();
          patch.trojanPass = randomHex(12);
        }
        await updateUser(db, id, patch);
        if (patch.usedUp !== undefined || patch.usedDown !== undefined) await flushUsage(db);
        await addEvent(db, 'user_updated', 'id=' + id);
        return json({ ok: true });
      }
      if (method === 'DELETE') {
        await deleteUser(db, id); // admin rows protected in SQL
        await addEvent(db, 'user_deleted', 'id=' + id);
        return json({ ok: true });
      }
    }

    const linksMatch = action.match(/^users\/(\d+)\/links$/);
    if (linksMatch && method === 'GET') {
      if (!db) throw new GzError('database_not_bound', 'no_db');
      const id = Number(linksMatch[1]);
      const u = (await listUsers(db)).find((x) => x.id === id);
      if (!u) throw new GzError('user not found', 'not_found');
      const host = new URL(request.url).hostname;
      const links = buildLinks(host, u);
      return json({
        links,
        subBase: 'https://' + host + '/' + eff.subPath + '/' + (await subTokenFor(host, u.uuid)),
        subClash: 'https://' + host + '/' + eff.subPath + '/' + (await subTokenFor(host, u.uuid)) + '/clash',
        subSingbox: 'https://' + host + '/' + eff.subPath + '/' + (await subTokenFor(host, u.uuid)) + '/singbox',
      });
    }

    if (action === 'events' && method === 'GET') {
      if (!db) return json({ events: [] });
      return json({ events: await recentEvents(db, 10) });
    }

    return json({ error: 'not_found' }, 404);
  } catch (e) {
    if (e instanceof GzError && e.code === 'unauthorized') {
      return json({ error: 'unauthorized' }, 401);
    }
    if (e instanceof GzError && e.code === 'validation') {
      return json({ error: e.message }, 400);
    }
    if (e instanceof GzError && e.code === 'no_db') {
      return json({ error: 'database_not_bound' }, 503);
    }
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

export async function checkIsAuthed(request: Request, eff: EffectiveSettings): Promise<boolean> {
  return isAuthed(request, eff);
}
