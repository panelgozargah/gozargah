/**
 * Gozargah — panel authentication.
 *
 * Fixes the benchmark anti-patterns:
 *  - PBKDF2-SHA256 password (no plaintext, no bare hash cookies like ZEUS)
 *  - HMAC-signed session token with expiry (never the password hash itself)
 *  - persisted login throttle in D1 (not per-isolate like ZEUS)
 */

import { DEFAULTS, Env, GzError } from './config';
import { EffectiveSettings } from './settings';
import { clearLoginThrottle, loginAttemptsLeft, recordLoginFailure } from './db/store';
import { constTimeEqual, hmacHex, pbkdf2Hex, sha256Hex } from './utils/crypto';

const COOKIE = 'gz_session';

function sessionSecret(eff: EffectiveSettings): Promise<string> {
  return sha256Hex(eff.passwordHash + ':' + eff.panelPath);
}

export async function verifyPanelPassword(eff: EffectiveSettings, password: string): Promise<boolean> {
  const h = await pbkdf2Hex(password, eff.passwordSalt, eff.pwIterations);
  return constTimeEqual(h, eff.passwordHash);
}

export async function makeSessionToken(eff: EffectiveSettings): Promise<string> {
  const exp = String(Date.now() + DEFAULTS.sessionTtlMs);
  const sig = await hmacHex(await sessionSecret(eff), exp);
  return exp + '.' + sig;
}

export async function verifySessionToken(eff: EffectiveSettings, token: string | null): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d{13,16}$/.test(exp) || Number(exp) < Date.now()) return false;
  const want = await hmacHex(await sessionSecret(eff), exp);
  return constTimeEqual(sig, want);
}

export function readSessionCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === COOKIE) return rest.join('=');
  }
  return null;
}

export function sessionCookie(token: string): string {
  return (
    COOKIE + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' +
    Math.floor(DEFAULTS.sessionTtlMs / 1000)
  );
}

export function clearedCookie(): string {
  return COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

export async function isAuthed(request: Request, eff: EffectiveSettings): Promise<boolean> {
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || null;
  const token = readSessionCookie(request) ?? bearer;
  return verifySessionToken(eff, token);
}

/** Throws 401-ish GzError when unauthenticated — API routes use this. */
export async function requireAuth(request: Request, eff: EffectiveSettings): Promise<void> {
  if (!(await isAuthed(request, eff))) throw new GzError('unauthorized', 'unauthorized');
}

export async function ipHash(request: Request): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  return sha256Hex('gzip:' + ip);
}

export interface LoginGateResult { allowed: boolean; attemptsLeft: number; }

export async function checkLoginGate(env: Env, request: Request): Promise<LoginGateResult> {
  const h = await ipHash(request);
  if (env.GZ_DB) {
    const left = await loginAttemptsLeft(env.GZ_DB, h);
    return { allowed: left > 0, attemptsLeft: left };
  }
  // no DB: per-isolate fallback (best effort, resets on eviction)
  const cur = memThrottle.get(h);
  if (cur && Date.now() - cur.windowStart < DEFAULTS.loginWindowMs && cur.count >= DEFAULTS.loginMaxAttempts) {
    return { allowed: false, attemptsLeft: 0 };
  }
  return { allowed: true, attemptsLeft: DEFAULTS.loginMaxAttempts };
}

export async function onLoginResult(env: Env, request: Request, success: boolean): Promise<void> {
  const h = await ipHash(request);
  if (env.GZ_DB) {
    if (success) await clearLoginThrottle(env.GZ_DB, h);
    else await recordLoginFailure(env.GZ_DB, h);
    return;
  }
  if (success) memThrottle.delete(h);
  else {
    const cur = memThrottle.get(h);
    if (cur && Date.now() - cur.windowStart < DEFAULTS.loginWindowMs) cur.count += 1;
    else memThrottle.set(h, { count: 1, windowStart: Date.now() });
  }
}

const memThrottle = new Map<string, { count: number; windowStart: number }>();
