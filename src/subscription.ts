/**
 * Gozargah — subscription engine. Everything is generated in-worker:
 * no third-party subconverter, no runtime dependency on raw.githubusercontent.
 *
 * Formats: base64 (v2rayNG/NeoR/Streisand) · clash-meta YAML · sing-box JSON
 *          · xray-core JSON (v1.2: observatory + leastPing auto-best + fragment)
 * Client detection: UA sniffing + explicit /{app} override.
 * v1.2 tuning: per-operator presets (?op=) + ECH strictly opt-in (?ech=1).
 * Headers: real Subscription-Userinfo from byte accounting (not fake {usage}).
 */

import { Env } from './config';
import { toBase64 } from './utils/crypto';
import { GzUser, listUsers } from './db/users';
import { EffectiveSettings } from './settings';
import { DEFAULT_FP, FragPreset, fpFor, opBranding, resolveOp, SubOpts } from './sub/operators';

export interface ClientLinks {
  vless: string;
  trojan: string;
  wsPath: string;
}

export interface BuildOpts extends SubOpts {
  /** alt TLS port (Workers HTTPS ports) — default 443 */
  port?: number;
  /** override remark label (default: auto) */
  remark?: string;
}

function remarkFor(user: { name: string }, opts: BuildOpts | null | undefined): string {
  const brand = opBranding(opts);
  const proto = ' Gozargah';
  if (brand) return proto + ' · ' + brand.fa + ' · ' + user.name;
  return proto + ' · ' + user.name;
}

export function buildLinks(
  host: string,
  user: { uuid: string; trojanPass: string; name: string },
  opts: BuildOpts | null | undefined,
): ClientLinks {
  const port = opts?.port && opts.port !== 443 ? opts.port : 443;
  const wsPath = '/' + user.uuid + '?ed=2048';
  const fp = fpFor(opts);
  const ech = opts?.ech ? '&ech=' : '';
  const tag = encodeURIComponent(remarkFor(user, opts));
  const params =
    'security=tls&sni=' + host + '&fp=' + fp + '&type=ws&host=' + host +
    '&path=' + encodeURIComponent(wsPath) + ech;
  const vless =
    'vless://' + user.uuid + '@' + host + ':' + port + '?encryption=none&' + params +
    '#' + tag;
  const trojan =
    'trojan://' + user.trojanPass + '@' + host + ':' + port + '?' + params +
    '#' + tag;
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

export function buildClashYaml(
  host: string,
  user: { uuid: string; trojanPass: string; name: string },
  opts: BuildOpts | null | undefined,
): string {
  const port = opts?.port && opts.port !== 443 ? opts.port : 443;
  const wsPath = '/' + user.uuid + '?ed=2048';
  const fp = fpFor(opts);
  const brand = opBranding(opts);
  const vName = 'Gozargah-VLESS-' + (brand ? brand.en.split(' ')[0] + '-' : '') + user.name;
  const tName = 'Gozargah-Trojan-' + (brand ? brand.en.split(' ')[0] + '-' : '') + user.name;
  const ech = opts?.ech
    ? '    ech-opts:\n      enabled: true\n'
    : '';
  const proxy = (name: string, kind: 'vless' | 'trojan'): string[] => [
    '  - name: "' + name + '"',
    '    type: ' + kind,
    '    server: ' + host,
    '    port: ' + port,
    kind === 'vless' ? '    uuid: ' + user.uuid : '    password: ' + user.trojanPass,
    '    tls: true',
    '    servername: ' + host,
    '    client-fingerprint: ' + fp,
    '    network: ws',
    '    udp: false',
    '    ws-opts:',
    '      path: "' + wsPath + '"',
    '      headers:',
    '        Host: ' + host,
    '      max-early-data: 2048',
    '      early-data-header-name: Sec-WebSocket-Protocol',
  ];
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
    ...proxy(vName, 'vless'),
    ech,
    ...proxy(tName, 'trojan'),
    ech,
    'proxy-groups:',
    '  - name: Gozargah',
    '    type: select',
    '    proxies:',
    '      - ' + vName,
    '      - ' + tName,
    'rules:',
    '  - MATCH,Gozargah',
    '',
  ].join('\n');
}

export function buildSingBoxJson(
  host: string,
  user: { uuid: string; trojanPass: string; name: string },
  opts: BuildOpts | null | undefined,
): string {
  const port = opts?.port && opts.port !== 443 ? opts.port : 443;
  const wsPath = '/' + user.uuid + '?ed=2048';
  const fp = fpFor(opts);
  const tls: Record<string, unknown> = {
    enabled: true,
    server_name: host,
    utls: { enabled: true, fingerprint: fp },
  };
  if (opts?.ech) tls.ech = { enabled: true };
  const transport = {
    type: 'ws',
    path: wsPath,
    headers: { Host: host },
    max_early_data: 2048,
    early_data_header_name: 'Sec-WebSocket-Protocol',
  };
  const brand = opBranding(opts);
  const vName = 'Gozargah-VLESS-' + (brand ? brand.en.split(' ')[0] + '-' : '') + user.name;
  const tName = 'Gozargah-Trojan-' + (brand ? brand.en.split(' ')[0] + '-' : '') + user.name;
  const cfg = {
    log: { level: 'info' },
    dns: { servers: ['1.1.1.1', '8.8.8.8'], strategy: 'ipv4_only' },
    inbounds: [{ type: 'mixed', tag: 'mixed-in', listen: '127.0.0.1', listen_port: 2080 }],
    outbounds: [
      {
        type: 'vless',
        tag: vName,
        server: host,
        server_port: port,
        uuid: user.uuid,
        tls,
        transport,
      },
      {
        type: 'trojan',
        tag: tName,
        server: host,
        server_port: port,
        password: user.trojanPass,
        tls,
        transport,
      },
      { type: 'direct', tag: 'direct' },
    ],
    route: { final: vName },
  };
  return JSON.stringify(cfg, null, 2);
}

/* --------------------------- xray-core JSON --------------------------- */

/**
 * Xray-core profile (v1.2) — the "always-connected" shape ported from the
 * production panel: burst probes across every gz-* outbound via the
 * observatory, and a leastPing balancer ("auto-best") routes the catch-all
 * through whichever outbound currently answers fastest. A throttled or
 * DPI-starved path is demoted automatically — no user action needed.
 *
 * Fragment (per-operator preset) rides as internal gzx-* freedom outbounds
 * that app-level clones dial through with dialerProxy.
 *
 * Naming contract: app outbounds = gz-* (probed + balanced), internal
 * transports = gzx-* (probed, never routed directly).
 */
export function buildXrayJson(
  host: string,
  user: { uuid: string; trojanPass: string; name: string },
  opts: BuildOpts | null | undefined,
): string {
  const port = opts?.port && opts.port !== 443 ? opts.port : 443;
  const wsPath = '/' + user.uuid + '?ed=2048';
  const fp = fpFor(opts);
  const op = resolveOp(opts?.opKey);
  const brand = opBranding(opts);
  const suffix = brand ? ' · ' + brand.fa : '';

  const stream = {
    network: 'ws',
    security: 'tls',
    tlsSettings: { serverName: host, allowInsecure: false, fingerprint: fp },
    wsSettings: { path: wsPath, headers: { Host: host } },
  };

  const outbounds: Array<Record<string, unknown>> = [
    {
      tag: 'gz-vless' + suffix,
      protocol: 'vless',
      settings: {
        vnext: [{
          address: host,
          port,
          users: [{ id: user.uuid, encryption: 'none', level: 0 }],
        }],
      },
      streamSettings: stream,
    },
    {
      tag: 'gz-trojan' + suffix,
      protocol: 'trojan',
      settings: {
        servers: [{ address: host, port, password: user.trojanPass, level: 0 }],
      },
      streamSettings: stream,
    },
  ];

  const appTags = ['gz-vless' + suffix, 'gz-trojan' + suffix];

  if (op?.frag) {
    const fragOut = (tag: string, preset: FragPreset): Record<string, unknown> => ({
      tag,
      protocol: 'freedom',
      settings: {
        domainStrategy: 'AsIs',
        fragment: { packets: preset.packets, length: preset.length, interval: preset.interval },
      },
    });
    outbounds.push(fragOut('gzx-frag', op.frag));
    outbounds.push({
      tag: 'gz-frag' + suffix,
      protocol: 'vless',
      settings: {
        vnext: [{
          address: host,
          port,
          users: [{ id: user.uuid, encryption: 'none', level: 0 }],
        }],
      },
      streamSettings: stream,
      dialerProxy: 'gzx-frag',
    });
    appTags.push('gz-frag' + suffix);
  }

  const cfg = {
    log: { loglevel: 'warning' },
    dns: { servers: ['localhost', '1.1.1.1'], queryStrategy: 'UseIPv4' },
    inbounds: [
      {
        tag: 'socks-in',
        listen: '127.0.0.1',
        port: 10808,
        protocol: 'socks',
        settings: { udp: true, auth: 'noauth' },
        sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic'] },
      },
      {
        tag: 'http-in',
        listen: '127.0.0.1',
        port: 10809,
        protocol: 'http',
        settings: {},
        sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic'] },
      },
    ],
    outbounds,
    observatory: {
      subjectSelector: ['gz-'],
      probeUrl: 'https://connectivitycheck.gstatic.com/generate_204',
      probeInterval: '3m',
      enableConcurrency: true,
    },
    routing: {
      domainStrategy: 'IPIfNonMatch',
      balancers: [
        { tag: 'auto-best', selector: appTags, strategy: { type: 'leastPing' } },
      ],
      rules: [
        // catch-all -> auto-best balancer (leastPing picks the winner live)
        { type: 'field', network: 'tcp,udp', balancerTag: 'auto-best' },
      ],
    },
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

/** Browser UAs get the rich status page; proxy clients get raw configs. */
export function isBrowserUa(ua: string): boolean {
  const s = (ua || '').toLowerCase();
  if (!s) return false;
  // known proxy clients never get the page (even if they mention mozilla)
  const clientMarkers = [
    'clash', 'sing-box', 'singbox', 'hiddify', 'v2ray', 'v2box', 'streisand',
    'shadowrocket', 'karing', 'nekobox', 'nekoring', 'happ', 'pharos',
    'stash', 'loon', 'surge', 'quantumult', 'wxvpn', 'foxray', 'sphere',
  ];
  if (clientMarkers.some((m) => s.includes(m))) return false;
  return /mozilla|chrome|safari|firefox|edg\/|edie|opera|samsungbrowser|applewebkit/.test(s);
}

export type SubApp = 'clash' | 'singbox' | 'v2ray' | 'xray' | 'page';

/** Resolve the requested app: explicit override > confident UA > browser page > base64. */
export function resolveApp(appOverride: string, ua: string): SubApp {
  const ov = (appOverride || '').toLowerCase();
  if (ov === 'page' || ov === 'status') return 'page';
  if (ov === 'clash') return 'clash';
  if (ov === 'singbox') return 'singbox';
  if (ov === 'xray') return 'xray';
  if (ov === 'v2ray' || ov === 'base64') return 'v2ray';
  const uaApp = sniffApp(ua);
  if (uaApp === 'clash' || uaApp === 'singbox') return uaApp;
  if (isBrowserUa(ua)) return 'page';
  return 'v2ray';
}

/* ------------------------------ response ------------------------------ */

export function subHeaders(
  eff: EffectiveSettings,
  host: string,
  user: GzUser,
  app: string,
  opts: SubOpts | null | undefined,
  token?: string,
): Headers {
  const h = new Headers();
  if (app === 'clash') h.set('content-type', 'text/yaml; charset=utf-8');
  else if (app === 'singbox' || app === 'xray') h.set('content-type', 'application/json; charset=utf-8');
  else h.set('content-type', 'text/plain; charset=utf-8');
  h.set('access-control-allow-origin', '*');
  h.set('cache-control', 'no-store');
  const brand = opBranding(opts);
  // HTTP headers are ByteString-only — Unicode titles ride the standard
  // `base64:` prefix that v2rayNG/Hiddify/Streisand natively decode.
  const title = 'Gozargah · ' + (brand ? brand.fa + ' · ' : '') + user.name;
  h.set('profile-title', 'base64:' + toBase64(title));
  h.set('profile-update-interval', '6');
  // the user's own live status page (v1.2) — falls back to the panel for admins w/o page
  if (token) h.set('profile-web-page-url', 'https://' + host + '/' + eff.subPath + '/' + token);
  else h.set('profile-web-page-url', 'https://' + host + '/' + eff.panelPath);
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

export function renderSub(app: string, host: string, user: GzUser, opts: SubOpts | null | undefined): { body: string; app: string } {
  if (app === 'clash') return { body: buildClashYaml(host, user, opts), app };
  if (app === 'singbox') return { body: buildSingBoxJson(host, user, opts), app };
  if (app === 'xray') return { body: buildXrayJson(host, user, opts), app };
  const links = buildLinks(host, user, opts);
  return { body: buildBase64([links]), app: 'v2ray' };
}

export { DEFAULT_FP };
export type { Env };
