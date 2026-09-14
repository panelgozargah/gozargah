/**
 * Gozargah — subscription engine. Everything is generated in-worker:
 * no third-party subconverter, no runtime dependency on raw.githubusercontent.
 *
 * Formats: base64 (v2rayNG/NeoR/Streisand) · clash-meta YAML · sing-box JSON
 * Client detection: UA sniffing + explicit /{app} override.
 * Headers: real Subscription-Userinfo from byte accounting (not fake {usage}).
 */

import { Env } from './config';
import { toBase64 } from './utils/crypto';
import { GzUser, listUsers } from './db/users';
import { EffectiveSettings } from './settings';

export interface ClientLinks {
  vless: string;
  trojan: string;
  wsPath: string;
}

export function buildLinks(host: string, user: { uuid: string; trojanPass: string; name: string }): ClientLinks {
  const wsPath = '/' + user.uuid + '?ed=2048';
  const tag = ' Gozargah · ' + user.name;
  const params =
    'security=tls&sni=' + host + '&fp=chrome&type=ws&host=' + host +
    '&path=' + encodeURIComponent(wsPath);
  const vless =
    'vless://' + user.uuid + '@' + host + ':443?encryption=none&' + params +
    '#' + encodeURIComponent('VLESS' + tag);
  const trojan =
    'trojan://' + user.trojanPass + '@' + host + ':443?' + params +
    '#' + encodeURIComponent('Trojan' + tag);
  return { vless, trojan, wsPath };
}

export async function subTokenFor(host: string, uuid: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('gz-sub:' + host + ':' + uuid));
  const hex = [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 20);
}

/** Resolve a subscription token to its user (admin included). */
export async function findUserByToken(db: D1Database, host: string, token: string): Promise<GzUser | null> {
  const users = await listUsers(db);
  for (const u of users) {
    if ((await subTokenFor(host, u.uuid)) === token) return u;
  }
  return null;
}

/* ------------------------------ formatters ------------------------------ */

export function buildBase64(links: ClientLinks[]): string {
  return toBase64(links.map((l) => l.vless + '\n' + l.trojan).join('\n'));
}

export function buildClashYaml(host: string, user: { uuid: string; trojanPass: string; name: string }): string {
  const wsPath = '/' + user.uuid + '?ed=2048';
  return [
    '# gozargah clash-meta profile',
    'mixed-port: 7890',
    'allow-lan: false',
    'mode: rule',
    'log-level: info',
    'dns:',
    '  enable: true',
    '  nameserver:',
    '    - 1.1.1.1',
    '    - 8.8.8.8',
    'proxies:',
    '  - name: "Gozargah-VLESS-' + user.name + '"',
    '    type: vless',
    '    server: ' + host,
    '    port: 443',
    '    uuid: ' + user.uuid,
    '    tls: true',
    '    servername: ' + host,
    '    client-fingerprint: chrome',
    '    network: ws',
    '    udp: false',
    '    ws-opts:',
    '      path: "' + wsPath + '"',
    '      headers:',
    '        Host: ' + host,
    '      max-early-data: 2048',
    '      early-data-header-name: Sec-WebSocket-Protocol',
    '  - name: "Gozargah-Trojan-' + user.name + '"',
    '    type: trojan',
    '    server: ' + host,
    '    port: 443',
    '    password: ' + user.trojanPass,
    '    sni: ' + host,
    '    client-fingerprint: chrome',
    '    network: ws',
    '    udp: false',
    '    ws-opts:',
    '      path: "' + wsPath + '"',
    '      headers:',
    '        Host: ' + host,
    '      max-early-data: 2048',
    '      early-data-header-name: Sec-WebSocket-Protocol',
    'proxy-groups:',
    '  - name: Gozargah',
    '    type: select',
    '    proxies:',
    '      - Gozargah-VLESS-' + user.name,
    '      - Gozargah-Trojan-' + user.name,
    'rules:',
    '  - MATCH,Gozargah',
    '',
  ].join('\n');
}

export function buildSingBoxJson(host: string, user: { uuid: string; trojanPass: string; name: string }): string {
  const wsPath = '/' + user.uuid + '?ed=2048';
  const tls = { enabled: true, server_name: host, utls: { enabled: true, fingerprint: 'chrome' } };
  const transport = {
    type: 'ws',
    path: wsPath,
    headers: { Host: host },
    max_early_data: 2048,
    early_data_header_name: 'Sec-WebSocket-Protocol',
  };
  const cfg = {
    log: { level: 'info' },
    dns: { servers: ['1.1.1.1', '8.8.8.8'] },
    inbounds: [{ type: 'mixed', tag: 'mixed-in', listen: '127.0.0.1', listen_port: 2080 }],
    outbounds: [
      {
        type: 'vless',
        tag: 'Gozargah-VLESS-' + user.name,
        server: host,
        server_port: 443,
        uuid: user.uuid,
        tls,
        transport,
      },
      {
        type: 'trojan',
        tag: 'Gozargah-Trojan-' + user.name,
        server: host,
        server_port: 443,
        password: user.trojanPass,
        tls,
        transport,
      },
      { type: 'direct', tag: 'direct' },
    ],
    route: { final: 'Gozargah-VLESS-' + user.name },
  };
  return JSON.stringify(cfg, null, 2);
}

/* ------------------------------ UA sniffing ------------------------------ */

export function sniffApp(ua: string): 'clash' | 'singbox' | 'v2ray' {
  const s = ua.toLowerCase();
  if (s.includes('clash') || s.includes('stash') || s.includes('vera') || s.includes('hiddify-clash')) return 'clash';
  if (s.includes('sing-box') || s.includes('singbox') || s.includes('karing') || s.includes('hiddify')) return 'singbox';
  return 'v2ray';
}

/* ------------------------------ response ------------------------------ */

export function subHeaders(eff: EffectiveSettings, host: string, user: GzUser, app: string): Headers {
  const h = new Headers();
  if (app === 'clash') h.set('content-type', 'text/yaml; charset=utf-8');
  else if (app === 'singbox') h.set('content-type', 'application/json; charset=utf-8');
  else h.set('content-type', 'text/plain; charset=utf-8');
  h.set('access-control-allow-origin', '*');
  h.set('cache-control', 'no-store');
  h.set('profile-title', 'Gozargah · ' + user.name);
  h.set('profile-update-interval', '6');
  h.set('profile-web-page-url', 'https://' + host + '/' + eff.panelPath);
  if (user.quotaBytes || user.expiryAt) {
    // REAL numbers from byte accounting (0 upload tracked separately in v2)
    const used = Math.max(0, user.usedUp + user.usedDown);
    h.set(
      'subscription-userinfo',
      'upload=' + user.usedUp + '; download=' + user.usedDown + '; total=' +
        (user.quotaBytes || 0) + '; expire=' + (user.expiryAt ? Math.floor(user.expiryAt / 1000) : 0),
    );
    h.set('x-gz-used-bytes', String(used));
  }
  return h;
}

export function renderSub(app: string, host: string, user: GzUser): { body: string; app: string } {
  const links = buildLinks(host, user);
  if (app === 'clash') return { body: buildClashYaml(host, user), app };
  if (app === 'singbox') return { body: buildSingBoxJson(host, user), app };
  return { body: buildBase64([links]), app: 'v2ray' };
}

export type { Env };
