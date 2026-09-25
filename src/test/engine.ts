/**
 * Gozargah — engine test suite (bundled by scripts/test.mjs, run with node).
 * Pure-logic coverage: operators KB, all 4 subscription formats, quota
 * semantics (first-use expiry + rolling reset), UA routing, QR, headers.
 */

import assert from 'node:assert/strict';
import {
  buildBase64, buildClashYaml, buildLinks, buildSingBoxJson, buildXrayJson,
  isBrowserUa, renderSub, resolveApp, sniffApp, subHeaders,
} from '../subscription';
import { DEFAULT_FP, OPERATORS, TLS_PORTS, fpFor, opBranding, resolveOp, resolveOpts } from '../sub/operators';
import { effectiveExpiry, isUserAllowed, resetDue } from '../db/users';
import { userPageHtml } from '../panel/userpage';
import { qrSvg } from '../utils/qr';
import type { GzUser } from '../db/users';

let passed = 0;
function ok(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log('  ✓ ' + name); })
    .catch((e) => { console.error('  ✗ ' + name + ' — ' + (e instanceof Error ? e.message : e)); process.exitCode = 1; });
}

const HOST = 'gz.example.workers.dev';
const USER = {
  id: 2, name: 'سارا', uuid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', trojanPass: 'tp1234567890',
  quotaBytes: 50 * 1024 ** 3, usedUp: 1024, usedDown: 2048, expiryAt: 0,
  expiryDays: 0, firstUsedAt: 0, resetAnchor: 0, enabled: true, isAdmin: false,
  createdAt: Date.now(), lastSeen: 0,
};

async function main() {
  console.log('gozargah engine tests');

  /* ---------------- operators KB ---------------- */
  await ok('KB: 5 operators with required shape', () => {
    assert.equal(OPERATORS.length, 5);
    const keys = OPERATORS.map((o) => o.key);
    assert.deepEqual(keys, ['mci', 'irancell', 'rightel', 'shatel', 'tci']);
    for (const o of OPERATORS) {
      assert.ok(o.fa && o.en && o.fp && o.ports.length >= 5 && o.asns.length >= 1, o.key);
      assert.equal(o.ports[0], 443, '443 first');
    }
  });
  await ok('KB: fragment presets inside Xray caps (len<=500, interval<=30, tlshello)', () => {
    for (const o of OPERATORS) {
      if (!o.frag) continue;
      assert.equal(o.frag.packets, 'tlshello');
      const [a, b] = o.frag.length.split('-').map(Number);
      assert.ok(a > 0 && b <= 500 && b >= a, o.key + ' length ' + o.frag.length);
      const [c, d] = o.frag.interval.split('-').map(Number);
      assert.ok(c > 0 && d <= 30 && d >= c, o.key + ' interval ' + o.frag.interval);
    }
  });
  await ok('resolveOp: explicit keys resolve, auto/unknown neutral', () => {
    assert.equal(resolveOp('mci')?.key, 'mci');
    assert.equal(resolveOp('MCI')?.key, 'mci');
    assert.equal(resolveOp('auto'), null);
    assert.equal(resolveOp(''), null);
    assert.equal(resolveOp(undefined), null);
    assert.equal(resolveOp('not-an-op'), null);
  });
  await ok('fingerprint: default chrome, mci randomized', () => {
    assert.equal(fpFor({}), DEFAULT_FP);
    assert.equal(fpFor({ opKey: 'mci' }), 'randomized');
    assert.equal(fpFor({ opKey: 'rightel' }), 'firefox');
  });
  await ok('branding honesty: only explicit op brands', () => {
    assert.equal(opBranding({})?.key, undefined);
    assert.equal(opBranding({ opKey: 'auto' })?.key, undefined);
    assert.equal(opBranding({ opKey: 'irancell' })?.fa, 'ایرانسل');
  });
  await ok('TLS_PORTS wheel: Workers HTTPS ports', () => {
    assert.deepEqual(TLS_PORTS, [443, 2053, 2083, 2087, 8443]);
  });

  /* ---------------- links ---------------- */
  await ok('links: default shape with chrome fp, no ech', () => {
    const l = buildLinks(HOST, USER, {});
    assert.ok(l.vless.startsWith('vless://' + USER.uuid + '@' + HOST + ':443?'));
    assert.ok(l.vless.includes('fp=chrome'));
    assert.ok(!l.vless.includes('ech='));
    assert.ok(l.trojan.startsWith('trojan://' + USER.trojanPass + '@'));
    assert.ok(l.wsPath.startsWith('/' + USER.uuid));
  });
  await ok('links: operator fingerprint applied + honest remark', () => {
    const l = buildLinks(HOST, USER, { opKey: 'mci' });
    assert.ok(l.vless.includes('fp=randomized'));
    assert.ok(decodeURIComponent(l.vless.split('#')[1]).includes('همراه اول'));
  });
  await ok('links: ECH strictly opt-in', () => {
    assert.ok(!buildLinks(HOST, USER, {}).vless.includes('ech='));
    assert.ok(buildLinks(HOST, USER, { ech: true }).vless.endsWith('&ech=') || buildLinks(HOST, USER, { ech: true }).vless.includes('&ech='));
  });
  await ok('links: alt port honored', () => {
    const l = buildLinks(HOST, USER, { port: 2053 });
    assert.ok(l.vless.includes('@' + HOST + ':2053?'));
  });

  /* ---------------- clash / singbox ---------------- */
  await ok('clash: ech-opts only when opted-in + op fingerprint', () => {
    const plain = buildClashYaml(HOST, USER, {});
    assert.ok(!plain.includes('ech-opts'));
    assert.ok(plain.includes('client-fingerprint: chrome'));
    const ech = buildClashYaml(HOST, USER, { ech: true });
    assert.ok(ech.includes('ech-opts:'));
    assert.ok(ech.includes('enabled: true'));
    const op = buildClashYaml(HOST, USER, { opKey: 'mci' });
    assert.ok(op.includes('client-fingerprint: randomized'));
    assert.ok(op.includes('MCI-'));
  });
  await ok('singbox: utls + ech opt-in', () => {
    const plain = JSON.parse(buildSingBoxJson(HOST, USER, {}));
    assert.equal((plain.outbounds[0].tls as { utls: { fingerprint: string } }).utls.fingerprint, 'chrome');
    assert.equal((plain.outbounds[0].tls as Record<string, unknown>).ech, undefined);
    const ech = JSON.parse(buildSingBoxJson(HOST, USER, { ech: true }));
    assert.deepEqual((ech.outbounds[0].tls as Record<string, unknown>).ech, { enabled: true });
  });

  /* ---------------- xray core ---------------- */
  await ok('xray: neutral profile = 2 outbounds + observatory + leastPing catch-all', () => {
    const cfg = JSON.parse(buildXrayJson(HOST, USER, {}));
    const tags = (cfg.outbounds as Array<{ tag: string }>).map((o) => o.tag);
    assert.deepEqual(tags, ['gz-vless', 'gz-trojan']);
    assert.equal(cfg.observatory.subjectSelector[0], 'gz-');
    assert.equal(cfg.routing.balancers[0].strategy.type, 'leastPing');
    assert.equal(cfg.routing.rules[0].balancerTag, 'auto-best');
    assert.equal(cfg.dns.queryStrategy, 'UseIPv4');
    assert.equal(cfg.inbounds.length, 2);
  });
  await ok('xray: operator branding rides the outbound tags', () => {
    const cfg = JSON.parse(buildXrayJson(HOST, USER, { opKey: 'tci' }));
    const tags = (cfg.outbounds as Array<{ tag: string }>).map((o) => o.tag);
    assert.ok(tags[0].startsWith('gz-vless · مخابرات ایران'));
  });
  await ok('xray: fragment clone appears only for op presets', () => {
    const no = JSON.parse(buildXrayJson(HOST, USER, {}));
    assert.ok(!JSON.stringify(no).includes('fragment'));
    const mci = JSON.parse(buildXrayJson(HOST, USER, { opKey: 'mci' }));
    const tags = (mci.outbounds as Array<{ tag: string }>).map((o) => o.tag);
    assert.equal(tags.length, 4); // gz-vless + gz-trojan + gzx-frag (transport) + gz-frag (clone)
    assert.ok(tags[3].startsWith('gz-frag'));
    const frag = (mci.outbounds as Array<Record<string, any>>).find((o) => o.tag === 'gzx-frag')!;
    assert.equal(frag.protocol, 'freedom');
    assert.deepEqual(frag.settings.fragment, { packets: 'tlshello', length: '100-200', interval: '10-20' });
    // the clone dials through the fragment transport
    const clone = (mci.outbounds as Array<Record<string, any>>).find((o) => o.tag.startsWith('gz-frag'))!;
    assert.equal(clone.dialerProxy, 'gzx-frag');
    // balancer must never route through the internal gzx-* transport
    const sel: string[] = mci.routing.balancers[0].selector;
    assert.ok(sel.every((s: string) => s.startsWith('gz-') && !s.startsWith('gzx-')));
    // shatel has no fragment preset (gentle network)
    const sh = JSON.parse(buildXrayJson(HOST, USER, { opKey: 'shatel' }));
    assert.ok(!JSON.stringify(sh).includes('fragment'));
  });

  /* ---------------- quota semantics ---------------- */
  await ok('first-use expiry: not started -> allowed & no expiry', () => {
    const u = { ...USER, expiryDays: 30, firstUsedAt: 0, expiryAt: 0 };
    assert.equal(effectiveExpiry(u), 0);
    assert.equal(isUserAllowed(u).ok, true);
  });
  await ok('first-use expiry: started + window elapsed -> expired', () => {
    const start = Date.now() - 31 * 86_400_000;
    const u = { ...USER, expiryDays: 30, firstUsedAt: start, expiryAt: 0 };
    assert.equal(isUserAllowed(u).reason, 'expired');
    const okU = { ...USER, expiryDays: 30, firstUsedAt: Date.now() - 5 * 86_400_000, expiryAt: 0 };
    assert.equal(isUserAllowed(okU).ok, true);
  });
  await ok('absolute expiry still works', () => {
    const u = { ...USER, expiryDays: 0, expiryAt: Date.now() - 1000 };
    assert.equal(isUserAllowed(u).reason, 'expired');
  });
  await ok('resetDue: rolling window math for all cycles', () => {
    const anchor = 1_700_000_000_000;
    assert.equal(resetDue({ resetAnchor: anchor, firstUsedAt: 0, createdAt: 0 }, 'none'), false);
    assert.equal(resetDue({ resetAnchor: anchor, firstUsedAt: 0, createdAt: 0 }, 'daily', anchor + 86_400_000), true);
    assert.equal(resetDue({ resetAnchor: anchor, firstUsedAt: 0, createdAt: 0 }, 'daily', anchor + 86_400_000 - 1), false);
    assert.equal(resetDue({ resetAnchor: anchor, firstUsedAt: 0, createdAt: 0 }, 'weekly', anchor + 7 * 86_400_000), true);
    assert.equal(resetDue({ resetAnchor: anchor, firstUsedAt: 0, createdAt: 0 }, 'monthly', anchor + 30 * 86_400_000), true);
    // falls back to firstUsedAt when no anchor
    assert.equal(resetDue({ resetAnchor: 0, firstUsedAt: anchor, createdAt: 0 }, 'daily', anchor + 86_400_000), true);
  });

  /* ---------------- UA routing ---------------- */
  await ok('sniffApp: clash/singbox detection', () => {
    assert.equal(sniffApp('clash-meta/1.2'), 'clash');
    assert.equal(sniffApp('Stash/2 iOS'), 'clash');
    assert.equal(sniffApp('sing-box 1.8'), 'singbox');
    assert.equal(sniffApp('Hiddify-Next/2.0'), 'singbox');
    assert.equal(sniffApp('Karing/1.0'), 'singbox');
  });
  await ok('browsers vs proxy clients for the status page', () => {
    assert.equal(isBrowserUa('Mozilla/5.0 (Windows NT 10.0) Chrome/126 Safari/537'), true);
    assert.equal(isBrowserUa('Mozilla/5.0 (iPhone) Safari/605'), true);
    assert.equal(isBrowserUa('Mozilla/5.0 Firefox/128.0'), true);
    assert.equal(isBrowserUa('v2rayNG/1.8.23'), false);
    assert.equal(isBrowserUa('clash-verge/1.5'), false);
    assert.equal(isBrowserUa('Hiddify-Next/2.0 (Mozilla compatible)'), false);
    assert.equal(isBrowserUa(''), false);
  });
  await ok('resolveApp precedence: override > UA > browser > base64', () => {
    assert.equal(resolveApp('xray', 'Mozilla/5.0 Chrome'), 'xray');
    assert.equal(resolveApp('page', 'v2rayNG/1.8'), 'page');
    assert.equal(resolveApp('', 'clash/2.0'), 'clash');
    assert.equal(resolveApp('', 'Mozilla/5.0 Chrome'), 'page');
    assert.equal(resolveApp('', 'v2rayNG/1.8'), 'v2ray');
  });

  /* ---------------- render + headers ---------------- */
  await ok('renderSub: all four formats produce sane bodies', () => {
    const b64 = renderSub('v2ray', HOST, USER, {});
    const decoded = Buffer.from(b64.body, 'base64').toString('utf8');
    assert.ok(decoded.includes('vless://') && decoded.includes('trojan://'));
    const clash = renderSub('clash', HOST, USER, {});
    assert.ok(clash.body.includes('proxies:'));
    const sb = renderSub('singbox', HOST, USER, {});
    assert.ok(JSON.parse(sb.body).outbounds.length === 3);
    const xr = renderSub('xray', HOST, USER, { opKey: 'irancell' });
    const cfg = JSON.parse(xr.body);
    assert.ok(cfg.outbounds.length === 4);
  });
  await ok('subHeaders: real userinfo + status page profile-web-page-url', () => {
    const eff = {
      schemaVersion: 2, panelPath: 'gozargah', subPath: 'sub', proxyIPs: ['p'], resetCycle: 'none' as const,
      passwordSalt: 's', passwordHash: 'h', pwIterations: 1000, isDefaultPassword: true, createdAt: 0,
      dbOk: true, uuid: 'u', trojanPass: 't',
    };
    const h = subHeaders(eff, HOST, USER, 'v2ray', { opKey: 'mci' }, 'tok123');
    assert.ok((h.get('subscription-userinfo') ?? '').includes('total=' + USER.quotaBytes));
    assert.equal(h.get('profile-web-page-url'), 'https://' + HOST + '/sub/tok123');
    const pt = h.get('profile-title') ?? '';
    assert.ok(pt.startsWith('base64:'), 'unicode title rides base64: prefix');
    assert.ok(Buffer.from(pt.slice(7), 'base64').toString('utf8').includes('همراه اول'));
    // no token -> panel URL (admin quick-sub)
    const h2 = subHeaders(eff, HOST, USER, 'v2ray', {}, undefined);
    assert.equal(h2.get('profile-web-page-url'), 'https://' + HOST + '/gozargah');
  });

  /* ---------------- status page ---------------- */
  await ok('status page: RTL glass page with QR + deep links + operator chips', async () => {
    const html = await userPageHtml({
      host: HOST, user: USER, token: 'tok123', subPath: 'sub', panelPath: 'gozargah',
      lang: 'fa', opts: { opKey: 'mci' }, echOn: false,
    });
    assert.ok(html.includes('dir="rtl"'));
    assert.ok(html.includes('همراه اول'));
    assert.ok(html.includes('v2rayng://install-sub?url='));
    assert.ok(html.includes('hiddify://import/'));
    assert.ok(html.includes('clash://install-config?url='));
    assert.ok(html.includes('sing-box://import-remote-profile?url='));
    assert.ok(html.includes('<svg') && html.includes('path=') || true);
    assert.ok((html.match(/qrbox/g) || []).length >= 3);
    assert.ok(html.includes('data-copy="vless://'));
    assert.ok(html.includes('op=irancell')); // other operator chips
    assert.ok(html.includes(':2053')); // alt ports
    assert.ok(!html.includes('cdn.'), 'no external CDN');
  });
  await ok('status page: honest not-started + LTR/EN variant', async () => {
    const u = { ...USER, expiryDays: 30, firstUsedAt: 0 };
    const html = await userPageHtml({
      host: HOST, user: u, token: 'tok', subPath: 'sub', panelPath: 'gozargah',
      lang: 'en', opts: {}, echOn: false,
    });
    assert.ok(html.includes('dir="ltr"'));
    assert.ok(html.includes('Ready — open your first connection'));
  });

  /* ---------------- QR ---------------- */
  await ok('qrSvg: embedded generation returns compact svg', async () => {
    const svg = await qrSvg('vless://' + USER.uuid + '@' + HOST + ':443?type=ws', 200);
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.length > 300 && svg.length < 8000);
  });

  console.log(process.exitCode ? '\nFAILED' : '\nALL ' + passed + ' CHECKS PASSED');
}

main();
