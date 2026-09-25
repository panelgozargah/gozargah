/**
 * Gozargah — per-user public status page (v1.2).
 *
 * Served at /{subPath}/{token} when the visitor is a browser (proxy
 * clients keep getting raw configs). Everything is server-rendered with
 * inline assets: Nexus glass design, RTL-first, dark/light, real byte
 * accounting, one-tap client imports (deep links), QR (embedded, no CDN),
 * per-operator tuning chips and alt TLS-port wheels.
 *
 * Honesty rules preserved: operator branding only for explicit ?op=,
 * "not started" state shown truthfully, no fake numbers anywhere.
 */

import { GzUser, effectiveExpiry } from '../db/users';
import { buildLinks, subTokenFor } from '../subscription';
import { OPERATORS, SubOpts, TLS_PORTS, opBranding } from '../sub/operators';
import { qrSvg } from '../utils/qr';
import { VERSION } from '../config';

type Lang = 'fa' | 'en';

const STR = {
  fa: {
    dir: 'rtl' as const,
    tagline: 'دروازهٔ امن عبور',
    statusTitle: 'وضعیت اتصال',
    active: 'فعال و آمادهٔ عبور',
    expired: 'منقضی شده',
    quotaReached: 'سهمیه پر شده',
    disabled: 'غیرفعال',
    notStarted: 'آماده — هنوز اولین اتصال را بزنید',
    used: 'مصرف‌شده',
    of: 'از',
    unlimited: 'نامحدود',
    expiry: 'انقضا',
    never: 'بدون انقضا',
    fromFirstUse: 'از اولین اتصال',
    days: 'روز',
    notStartedYet: 'با اولین اتصال شمارش شروع می‌شود',
    lastSeen: 'آخرین فعالیت',
    neverSeen: 'هنوز متصل نشده',
    importHub: 'افزودن به کلاینت',
    importHubHint: 'یک کلیک — لینک اشتراک شما به‌طور خودکار وارد کلاینت می‌شود',
    copySub: 'کپی لینک اشتراک',
    showQr: 'نمایش QR',
    hideQr: 'بستن QR',
    formats: 'قالب اشتراک',
    formatsHint: 'معمولاً لازم نیست دستی انتخاب کنید — کلاینت خودش می‌فهمد',
    fmtAuto: 'خودکار',
    fmtBase: 'Base64 (v2rayNG…)',
    fmtClash: 'Clash-Meta',
    fmtSingbox: 'Sing-box',
    fmtXray: 'Xray-core (اتصال خودکار بهترین)',
    operators: 'اپراتور اینترنتی',
    operatorsHint: 'اپراتور را انتخاب کنید — فینگرپرینت TLS و فرگمنت اختصاصی همان اپراتور روی کانفیگ‌ها اعمال می‌شود',
    opAuto: 'خودکار (بی‌برند)',
    altPorts: 'اگر پورت ۴۴۳ فیلتر شده است',
    altPortsHint: 'کلادفلر ورکرز روی این پورت‌های HTTPS هم پاسخ می‌دهد — لینک جایگزین را کپی کنید',
    rawLinks: 'لینک‌های خام (VLESS / Trojan)',
    echNote: 'ECH فعال شد — فقط اگر کلاینت و شبکهٔ شما ECH را پشتیبانی می‌کند روشنش کنید (DPI ایران با ECH مشکل دارد)',
    poweredBy: 'با گذرگاه ساخته شده — پنل پروکسی یک‌فایلی روی Cloudflare Workers',
    copied: 'کپی شد ✓',
    vlessLabel: 'VLESS',
    trojanLabel: 'Trojan',
    subLabel: 'اشتراک',
    themeDark: 'تم تاریک',
    themeLight: 'تم روشن',
  },
  en: {
    dir: 'ltr' as const,
    tagline: 'Secure passage gateway',
    statusTitle: 'Connection status',
    active: 'Active & ready',
    expired: 'Expired',
    quotaReached: 'Quota reached',
    disabled: 'Disabled',
    notStarted: 'Ready — open your first connection',
    used: 'Used',
    of: 'of',
    unlimited: 'Unlimited',
    expiry: 'Expiry',
    never: 'Never expires',
    fromFirstUse: 'from first use',
    days: 'days',
    notStartedYet: 'counting starts on first connection',
    lastSeen: 'Last seen',
    neverSeen: 'Never connected',
    importHub: 'Import to client',
    importHubHint: 'One tap — your subscription is imported automatically',
    copySub: 'Copy subscription link',
    showQr: 'Show QR',
    hideQr: 'Hide QR',
    formats: 'Subscription format',
    formatsHint: 'You rarely need this — clients pick the right format themselves',
    fmtAuto: 'Auto',
    fmtBase: 'Base64 (v2rayNG…)',
    fmtClash: 'Clash-Meta',
    fmtSingbox: 'Sing-box',
    fmtXray: 'Xray-core (auto-best)',
    operators: 'Mobile operator',
    operatorsHint: 'Pick your ISP — its dedicated TLS fingerprint & fragment preset are applied to the configs',
    opAuto: 'Auto (neutral)',
    altPorts: 'If port 443 is blocked',
    altPortsHint: 'Cloudflare Workers also answers on these HTTPS ports — copy an alternative link',
    rawLinks: 'Raw links (VLESS / Trojan)',
    echNote: 'ECH is ON — only enable it if your client AND network support it (Iranian DPI interferes with ECH)',
    poweredBy: 'Built with Gozargah — the one-file proxy panel on Cloudflare Workers',
    copied: 'Copied ✓',
    vlessLabel: 'VLESS',
    trojanLabel: 'Trojan',
    subLabel: 'Subscription',
    themeDark: 'Dark',
    themeLight: 'Light',
  },
};

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function fmtBytes(n: number): string {
  if (!n || n <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return (i === 0 ? v : v.toFixed(v >= 100 ? 0 : 1)) + ' ' + u[i];
}

function fmtDate(ms: number, lang: Lang): string {
  try { return new Date(ms).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-GB'); }
  catch { return new Date(ms).toISOString().slice(0, 10); }
}

export interface UserPageParams {
  host: string;
  user: GzUser;
  token: string;
  subPath: string;
  panelPath: string;
  lang: Lang;
  opts: SubOpts;
  echOn: boolean;
}

export async function userPageHtml(p: UserPageParams): Promise<string> {
  const S = STR[p.lang];
  const { host, user, token } = p;
  const opts = p.opts;
  const base = 'https://' + host + '/' + p.subPath + '/' + token;

  const links = buildLinks(host, user, opts);
  const brand = opBranding(opts);

  const q = (extra: string): string => base + extra;
  const withOp = (path: string): string => {
    const usp = new URLSearchParams();
    if (brand) usp.set('op', brand.key);
    if (p.echOn) usp.set('ech', '1');
    const qs = usp.toString();
    return base + path + (qs ? '?' + qs : '');
  };

  const autoSub = q(uspStr(brand, p.echOn));
  const deep = {
    v2rayng: 'v2rayng://install-sub?url=' + encodeURIComponent(autoSub),
    hiddify: 'hiddify://import/' + autoSub,
    clash: 'clash://install-config?url=' + encodeURIComponent(withOp('/clash')),
    singbox: 'sing-box://import-remote-profile?url=' + encodeURIComponent(withOp('/singbox')),
  };

  const used = Math.max(0, user.usedUp + user.usedDown);
  const pct = user.quotaBytes ? Math.min(100, Math.round((used / user.quotaBytes) * 100)) : 0;
  const exp = effectiveExpiry(user);
  const now = Date.now();

  let state: 'active' | 'expired' | 'quota' | 'disabled' | 'notStarted' = 'active';
  if (!user.enabled) state = 'disabled';
  else if (exp && now > exp) state = 'expired';
  else if (user.quotaBytes && used >= user.quotaBytes) state = 'quota';
  else if (user.expiryDays > 0 && !user.firstUsedAt) state = 'notStarted';

  const stateLabel = S[state === 'quota' ? 'quotaReached' : state];
  const ringPct = state === 'quota' ? 100 : pct;

  // expiry text — honest in all three modes
  let expiryText: string;
  if (user.expiryDays > 0) {
    expiryText = user.firstUsedAt
      ? fmtDate(exp, p.lang) + ' <small>(' + user.expiryDays + ' ' + S.days + ' ' + S.fromFirstUse + ')</small>'
      : '<b>' + user.expiryDays + ' ' + S.days + '</b> <small>' + S.notStartedYet + '</small>';
  } else if (user.expiryAt) {
    expiryText = fmtDate(user.expiryAt, p.lang);
  } else {
    expiryText = S.never;
  }

  const [qrSub, qrVless, qrTrojan] = await Promise.all([
    qrSvg(autoSub, 210),
    qrSvg(links.vless, 210),
    qrSvg(links.trojan, 210),
  ]);

  const langSwap: Lang = p.lang === 'fa' ? 'en' : 'fa';
  const usp = new URLSearchParams();
  usp.set('lang', langSwap);
  if (brand) usp.set('op', brand.key);
  if (p.echOn) usp.set('ech', '1');
  const langUrl = base + '?' + usp.toString();

  const themeInit = `<script>try{var t=localStorage.getItem('gzup_theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}</script>`;

  const portRows = TLS_PORTS.map((port) => {
    const lp = buildLinks(host, user, { ...opts, port });
    return '<div class="crow"><span class="clab mono">' + port + '</span>' +
      '<span class="cval mono" dir="ltr">' + esc(lp.vless.slice(0, 72)) + '…</span>' +
      '<button class="btn sm" type="button" data-copy="' + esc(lp.vless) + '">⧉</button></div>';
  }).join('');

  const fmtChips: Array<[string, string, string]> = [
    ['', S.fmtAuto, autoSub],
    ['/v2ray', S.fmtBase, withOp('/v2ray')],
    ['/clash', S.fmtClash, withOp('/clash')],
    ['/singbox', S.fmtSingbox, withOp('/singbox')],
    ['/xray', S.fmtXray, withOp('/xray')],
  ];
  const fmtHtml = fmtChips.map(([path, label], i) => {
    const active = i === 0;
    return '<a class="chip' + (active ? ' on' : '') + '" href="' + esc(fmtChips[i][2]) + '" rel="noopener">' + esc(label) + '</a>';
  }).join('');

  const opHtml =
    '<a class="chip' + (!brand ? ' on' : '') + '" href="' + esc(q(uspStr(null, p.echOn))) + '">' + esc(S.opAuto) + '</a>' +
    OPERATORS.map((o) => {
      const us = new URLSearchParams();
      us.set('op', o.key);
      if (p.echOn) us.set('ech', '1');
      return '<a class="chip' + (brand?.key === o.key ? ' on' : '') + '" href="' + esc(base + '?' + us.toString()) + '">' + esc(o.fa) + '</a>';
    }).join('');

  return `<!doctype html>
<html lang="${p.lang}" dir="${S.dir}" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(brand ? brand.fa + ' · ' : '')}${esc(user.name)} · ${esc(S.statusTitle)}</title>
${themeInit}
<style>
:root{
  --bg:#050816; --bg2:#0A0F24; --card:rgba(255,255,255,.045); --card2:rgba(255,255,255,.07);
  --line:rgba(148,163,184,.16); --tx:#F1F5F9; --mut:#94A3B8;
  --c1:#00D9FF; --c2:#2563EB; --c3:#7C3AED; --c4:#D946EF;
  --ok:#22C55E; --warn:#F59E0B; --bad:#EF4444;
  --grad:linear-gradient(90deg,var(--c1),var(--c2),var(--c3),var(--c4));
}
html[data-theme="light"]{
  --bg:#F4F7FB; --bg2:#E9EEF7; --card:rgba(255,255,255,.8); --card2:rgba(255,255,255,.95);
  --line:rgba(30,41,59,.12); --tx:#0F172A; --mut:#5B6B82;
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{
  font-family:Vazirmatn,'Segoe UI',Tahoma,sans-serif; background:var(--bg); color:var(--tx);
  min-height:100vh; line-height:1.65; overflow-x:hidden;
}
body::before{content:'';position:fixed;inset:0;z-index:-2;background:
  radial-gradient(900px 480px at 82% -8%,rgba(124,58,237,.16),transparent 62%),
  radial-gradient(760px 420px at 8% 4%,rgba(0,217,255,.12),transparent 58%),
  radial-gradient(680px 460px at 50% 108%,rgba(217,70,239,.10),transparent 60%);}
html[data-theme="light"] body::before{opacity:.5}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.wrap{max-width:760px;margin:0 auto;padding:22px 16px 44px}
.top{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.emblem{width:40px;height:36px;flex:none}
.emblem svg{width:100%;height:100%}
.brand b{font-size:16px;font-weight:800;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.brand small{display:block;color:var(--mut);font-size:11px}
.spacer{flex:1}
.tbtn{border:1px solid var(--line);background:var(--card);color:var(--tx);border-radius:10px;padding:6px 12px;font:inherit;font-size:12px;cursor:pointer;transition:.18s}
.tbtn:hover{border-color:var(--c1);transform:translateY(-1px)}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px;margin-bottom:14px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.card h3{font-size:14px;font-weight:800;margin-bottom:4px}
.card .hint{color:var(--mut);font-size:12px;margin-bottom:12px}
.gradtext{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.pill{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:7px 16px;font-size:13px;font-weight:700;border:1px solid}
.pill .dot{width:9px;height:9px;border-radius:50%}
.pill.ok{color:var(--ok);border-color:rgba(34,197,94,.4);background:rgba(34,197,94,.09)}
.pill.ok .dot{background:var(--ok);box-shadow:0 0 12px var(--ok);animation:pulse 2.2s infinite}
.pill.warn{color:var(--warn);border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.09)}
.pill.warn .dot{background:var(--warn)}
.pill.bad{color:var(--bad);border-color:rgba(239,68,68,.4);background:rgba(239,68,68,.09)}
.pill.bad .dot{background:var(--bad)}
.pill.idle{color:var(--c1);border-color:rgba(0,217,255,.4);background:rgba(0,217,255,.08)}
.pill.idle .dot{background:var(--c1)}
@keyframes pulse{0%,100%{box-shadow:0 0 4px var(--ok)}50%{box-shadow:0 0 14px var(--ok)}}
.hero{text-align:center;padding:28px 20px}
.hero .uname{font-size:24px;font-weight:900;margin:10px 0 12px}
.vitals{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}
.vital{background:var(--card2);border:1px solid var(--line);border-radius:14px;padding:16px;text-align:center}
.vital .k{color:var(--mut);font-size:12px;margin-bottom:8px}
.vital .v{font-size:17px;font-weight:800;direction:ltr}
.vital .s{color:var(--mut);font-size:11px;margin-top:4px}
.ring-wrap{position:relative;width:118px;height:118px;margin:2px auto 6px}
.ring-wrap svg{width:100%;height:100%;transform:rotate(-90deg)}
.ring-val{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ring-val b{font-size:19px}
.ring-val small{color:var(--mut);font-size:10px}
.hub .subrow{display:flex;gap:8px;align-items:center;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:10px 0 14px}
.hub .subrow .val{flex:1;font-size:12px;direction:ltr;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mut)}
.btn{border:1px solid var(--line);background:var(--card2);color:var(--tx);border-radius:10px;padding:8px 14px;font:inherit;font-size:12.5px;cursor:pointer;transition:.18s;text-decoration:none;display:inline-flex;align-items:center;gap:6px;justify-content:center}
.btn:hover{border-color:var(--c1);transform:translateY(-1px)}
.btn.primary{background:var(--grad);border:none;color:#fff;font-weight:700}
.btn.primary:hover{filter:brightness(1.12)}
.btn.sm{padding:6px 10px;font-size:11.5px;border-radius:9px}
.apps{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.apps .app{flex-direction:column;padding:14px 8px;gap:6px;border-radius:14px}
.apps .app b{font-size:12.5px}
.apps .app svg{width:26px;height:26px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{border:1px solid var(--line);background:var(--card2);color:var(--tx);border-radius:999px;padding:7px 15px;font:inherit;font-size:12.5px;cursor:pointer;text-decoration:none;transition:.18s}
.chip:hover{border-color:var(--c3);transform:translateY(-1px)}
.chip.on{background:var(--grad);border-color:transparent;color:#fff;font-weight:700;box-shadow:0 4px 18px rgba(124,58,237,.35)}
.ech{margin-top:10px;color:var(--warn);font-size:11.5px}
details{border:1px solid var(--line);border-radius:14px;background:var(--card2);margin-bottom:10px;overflow:hidden}
details summary{cursor:pointer;padding:13px 16px;font-size:13px;font-weight:700;list-style:none}
details summary::-webkit-details-marker{display:none}
details summary::after{content:'▾';float:inline-end;color:var(--mut);transition:.2s}
details[open] summary::after{transform:rotate(180deg)}
details .inner{padding:2px 16px 14px}
.crow{display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px dashed var(--line);font-size:12px}
.crow:last-child{border-bottom:none}
.clab{color:var(--c1);font-weight:700;min-width:52px}
.cval{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mut);direction:ltr;text-align:left}
.qrbox{display:none;margin-top:12px;text-align:center}
.qrbox.show{display:block;animation:fade .25s}
.qrbox .qcard{display:inline-block;background:#fff;padding:12px;border-radius:14px}
.qrbox .qcard svg{width:190px;height:190px}
@keyframes fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.note{color:var(--mut);font-size:11.5px;margin-top:10px}
footer{text-align:center;color:var(--mut);font-size:11.5px;margin-top:26px}
footer b{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.toast{position:fixed;bottom:22px;inset-inline-start:50%;transform:translateX(50%);background:var(--grad);color:#fff;padding:9px 20px;border-radius:999px;font-size:13px;font-weight:700;opacity:0;transition:.3s;pointer-events:none;z-index:50}
html[dir="ltr"] .toast{transform:translateX(-50%)}
.toast.show{opacity:1}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<div class="wrap">

<div class="top">
  <span class="emblem"><svg viewBox="0 0 120 104" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gza" x1="18" y1="96" x2="102" y2="8" gradientUnits="userSpaceOnUse"><stop stop-color="#00D9FF"/><stop offset=".45" stop-color="#2563EB"/><stop offset=".75" stop-color="#7C3AED"/><stop offset="1" stop-color="#D946EF"/></linearGradient></defs><path d="M18,94 V54 C18,26 37,11 60,9 C83,11 102,26 102,54 V94" stroke="url(#gza)" stroke-width="4" stroke-linecap="round"/><path d="M10,94 H110" stroke="rgba(148,163,184,.35)" stroke-width="2.4" stroke-linecap="round"/><circle cx="60" cy="9" r="3" fill="#D946EF"><animate attributeName="r" values="3;4.4;3" dur="2.4s" repeatCount="indefinite"/></circle></svg></span>
  <div class="brand"><b>${p.lang === 'fa' ? 'گذرگاه' : 'Gozargah'}</b><small>${esc(S.tagline)}</small></div>
  <div class="spacer"></div>
  <a class="tbtn" href="${esc(langUrl)}" rel="noopener">${p.lang === 'fa' ? 'EN' : 'فا'}</a>
  <button class="tbtn" id="theme-btn" type="button">☀️</button>
</div>

<div class="card hero">
  <span class="pill ${state === 'active' || state === 'notStarted' ? (state === 'active' ? 'ok' : 'idle') : state === 'quota' || state === 'expired' ? 'warn' : 'bad'}">
    <span class="dot"></span>${esc(stateLabel)}
  </span>
  <div class="uname">${esc(brand ? brand.fa + ' · ' : '')}${esc(user.name)}</div>
  <div class="vitals">
    <div class="vital">
      <div class="k">${esc(S.used)}${user.quotaBytes ? ' (' + esc(S.of) + ' <span dir="ltr" style="display:inline-block">' + fmtBytes(user.quotaBytes) + '</span>)' : ''}</div>
      <div class="ring-wrap">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(148,163,184,.18)" stroke-width="9"/>
          <circle cx="60" cy="60" r="50" fill="none" stroke="url(#gzring)" stroke-width="9" stroke-linecap="round"
            stroke-dasharray="${(314.16 * ringPct / 100).toFixed(1)} 314.16"/>
          <defs><linearGradient id="gzring" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#00D9FF"/><stop offset=".5" stop-color="#7C3AED"/><stop offset="1" stop-color="#D946EF"/>
          </linearGradient></defs>
        </svg>
        <div class="ring-val"><b dir="ltr">${fmtBytes(used)}</b><small>${user.quotaBytes ? ringPct + '%' : esc(S.unlimited)}</small></div>
      </div>
    </div>
    <div class="vital">
      <div class="k">${esc(S.expiry)}</div>
      <div class="v" style="font-size:15px">${expiryText}</div>
      <div class="s">${user.expiryDays > 0 ? esc(S.fromFirstUse) : ''}</div>
    </div>
    <div class="vital">
      <div class="k">${esc(S.lastSeen)}</div>
      <div class="v" style="font-size:15px">${user.lastSeen ? fmtDate(user.lastSeen, p.lang) : esc(S.neverSeen)}</div>
      <div class="s">${esc(VERSION)}</div>
    </div>
  </div>
</div>

<div class="card hub">
  <h3>${esc(S.importHub)}</h3>
  <div class="hint">${esc(S.importHubHint)}</div>
  <div class="subrow">
    <span class="val mono">${esc(autoSub)}</span>
    <button class="btn sm" type="button" data-copy="${esc(autoSub)}">⧉ ${esc(p.lang === 'fa' ? 'کپی' : 'Copy')}</button>
    <button class="btn sm" type="button" data-qrtoggle="qr-sub">${esc(S.showQr)}</button>
  </div>
  <div class="qrbox" id="qr-sub"><span class="qcard">${qrSub}</span></div>
  <div class="apps">
    <a class="btn app" href="${esc(deep.v2rayng)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M10.5 18.6h3"/></svg><b>v2rayNG</b></a>
    <a class="btn app" href="${esc(deep.hiddify)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l9 5v8l-9 5-9-5V8z"/><path d="M12 8.4l4.4 2.5v3L12 16.4l-4.4-2.5v-3z"/></svg><b>Hiddify</b></a>
    <a class="btn app" href="${esc(deep.clash)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="1.9" fill="currentColor"/><circle cx="15" cy="12" r="1.9" fill="currentColor"/><circle cx="7" cy="17" r="1.9" fill="currentColor"/></svg><b>Clash-Meta</b></a>
    <a class="btn app" href="${esc(deep.singbox)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M13 2.5L5 13h5.4L10 21.5 19 10.4h-5.6z"/></svg><b>Sing-box / Karing</b></a>
  </div>
</div>

<div class="card">
  <h3>${esc(S.operators)}</h3>
  <div class="hint">${esc(S.operatorsHint)}</div>
  <div class="chips">${opHtml}</div>
  ${p.echOn ? '<div class="ech">⚠ ' + esc(S.echNote) + '</div>' : ''}
</div>

<div class="card">
  <h3>${esc(S.formats)}</h3>
  <div class="hint">${esc(S.formatsHint)}</div>
  <div class="chips">${fmtHtml}</div>
</div>

<details>
  <summary>🔌 ${esc(S.altPorts)}</summary>
  <div class="inner">
    <div class="hint" style="margin:6px 0 4px">${esc(S.altPortsHint)}</div>
    ${portRows}
  </div>
</details>

<details>
  <summary>📋 ${esc(S.rawLinks)}</summary>
  <div class="inner">
    <div class="crow"><span class="clab">${esc(S.vlessLabel)}</span><span class="cval mono">${esc(links.vless)}</span>
      <button class="btn sm" type="button" data-copy="${esc(links.vless)}">⧉</button>
      <button class="btn sm" type="button" data-qrtoggle="qr-vless">QR</button></div>
    <div class="qrbox" id="qr-vless"><span class="qcard">${qrVless}</span></div>
    <div class="crow"><span class="clab">${esc(S.trojanLabel)}</span><span class="cval mono">${esc(links.trojan)}</span>
      <button class="btn sm" type="button" data-copy="${esc(links.trojan)}">⧉</button>
      <button class="btn sm" type="button" data-qrtoggle="qr-trojan">QR</button></div>
    <div class="qrbox" id="qr-trojan"><span class="qcard">${qrTrojan}</span></div>
  </div>
</details>

<footer>${esc(S.poweredBy)} · <b>v${esc(VERSION)}</b></footer>
</div>

<div class="toast" id="toast">${esc(S.copied)}</div>

<script>
(function(){
  'use strict';
  var btn=document.getElementById('theme-btn');
  function paint(){btn.textContent=document.documentElement.dataset.theme==='light'?'🌙':'☀️';}
  paint();
  btn.addEventListener('click',function(){
    var next=document.documentElement.dataset.theme==='light'?'dark':'light';
    document.documentElement.dataset.theme=next;
    try{localStorage.setItem('gzup_theme',next);}catch(e){}
    paint();
  });
  var toastEl=document.getElementById('toast'),tt=null;
  function toast(){toastEl.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){toastEl.classList.remove('show');},1400);}
  document.addEventListener('click',function(e){
    var el=e.target instanceof Element?e.target:null;if(!el)return;
    var cp=el.closest('[data-copy]');
    if(cp){
      var txt=cp.getAttribute('data-copy')||'';
      var done=function(){toast();};
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done,function(){fb();});else fb();
      function fb(){var ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(err){}ta.remove();}
      return;
    }
    var qt=el.closest('[data-qrtoggle]');
    if(qt){
      var box=document.getElementById(qt.getAttribute('data-qrtoggle'));
      if(box){box.classList.toggle('show');}
    }
  });
})();
</script>
</body>
</html>`;
}

function uspStr(brand: { key: string } | null, ech: boolean): string {
  const usp = new URLSearchParams();
  if (brand) usp.set('op', brand.key);
  if (ech) usp.set('ech', '1');
  const s = usp.toString();
  return s ? '?' + s : '';
}

// keep subTokenFor import referenced for type completeness in future extensions
void subTokenFor;
