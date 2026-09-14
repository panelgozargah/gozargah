/**
 * Gozargah — worker entry point & router.
 *
 * Route map:
 *   ANY  (websocket upgrade)  -> proxy pipeline (VLESS/Trojan over WS)
 *   GET  /                    -> stealth landing page
 *   GET  /robots.txt          -> disallow all
 *   GET  /favicon.png         -> embedded logo
 *   GET  /{panelPath}         -> panel UI (SPA)
 *   POST /{panelPath}/api/*   -> panel JSON API
 *   GET  /{subPath}/{token}       -> subscription (UA-sniffed format)
 *   GET  /{subPath}/{token}/{app} -> explicit format (clash | singbox | v2ray)
 *   GET  anything else        -> stealth landing (no info leak, nahan-style)
 */

import { Env, VERSION } from './config';
import { getEffectiveSettings } from './settings';
import { acceptWebSocket } from './handlers/websocket';
import { findUserByToken, renderSub, sniffApp, subHeaders } from './subscription';
import { handlePanelApi } from './panel/api';
import { panelHtml } from './panel/ui';
import { landingHtml } from './panel/landing';
import { LOGO_FAV_B64 } from './assets/logo';
import { glog, logRing } from './utils/log';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(request, env, ctx);
    } catch (e) {
      glog('router error: ' + (e instanceof Error ? e.message : String(e)));
      return new Response(landingHtml('fa'), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
  },
};

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  // 1) proxy data plane — websocket upgrades on any path
  if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
    return acceptWebSocket(request, env, ctx);
  }

  const rawPath = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, '');
  const host = url.host;

  // 2) static/stealth endpoints
  if (rawPath === 'favicon.ico' || rawPath === 'favicon.png') {
    const bytes = atob(LOGO_FAV_B64.split(',')[1]);
    const buf = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    return new Response(buf, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } });
  }
  if (rawPath === 'robots.txt') {
    return new Response('User-agent: *\nDisallow: /\n', { headers: { 'content-type': 'text/plain' } });
  }
  if (rawPath === 'healthz') {
    return new Response(JSON.stringify({ ok: true, version: VERSION }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  // 3) panel
  const eff = await getEffectiveSettings(env, host);
  if (rawPath === eff.panelPath) {
    const html = panelHtml({
      panelPath: eff.panelPath,
      dbOk: eff.dbOk,
      isDefaultPassword: eff.isDefaultPassword,
      version: VERSION,
      lang: 'fa',
    });
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  if (rawPath.startsWith(eff.panelPath + '/api/')) {
    const action = rawPath.slice(eff.panelPath.length + 5); // strip "{panelPath}/api/"
    return handlePanelApi(request, env, eff, action);
  }

  // 4) subscription — /{subPath}/{token}[/{app}]
  if (rawPath.startsWith(eff.subPath + '/') && env.GZ_DB) {
    const segs = rawPath.slice(eff.subPath.length + 1).split('/').filter(Boolean);
    const token = segs[0] ?? '';
    const appOverride = (segs[1] ?? url.searchParams.get('app') ?? '').toLowerCase();
    const user = await findUserByToken(env.GZ_DB, url.hostname, token);
    if (user) {
      const app = appOverride === 'clash' || appOverride === 'singbox' || appOverride === 'v2ray'
        ? appOverride
        : sniffApp(request.headers.get('user-agent') ?? '');
      const { body } = renderSub(app, url.hostname, user);
      return new Response(body, { headers: subHeaders(eff, url.hostname, user, app) });
    }
    // unknown token: fall through to stealth landing (no user enumeration)
  }

  // 5) landing for everything else (stealth, nahan-style no-leak)
  return new Response(landingHtml('fa'), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// keep logRing referenced (debug endpoint reads it)
void logRing;
