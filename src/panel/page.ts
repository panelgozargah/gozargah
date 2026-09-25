/**
 * Gozargah — panel page skeleton (Gozargah Nexus UI layout).
 * 250px glass sidebar (drawer on mobile) + sticky topbar + spacious content.
 * The "passage arch" emblem is the brand signature: a traveler dot passes
 * through the gate — گذرگاه means "passage". Gradient follows the Nexus palette.
 */

import { PANEL_JS } from './script';
import { DICTS } from './i18n';

export function emblemSvg(cls: string, uid = 'g'): string {
  const gid = 'gza-' + uid;
  return (
    '<div class="emblem ' + cls + '">' +
    '<svg viewBox="0 0 120 104" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<defs><linearGradient id="' + gid + '" x1="18" y1="96" x2="102" y2="8" gradientUnits="userSpaceOnUse">' +
    '<stop stop-color="#00D9FF"/><stop offset=".45" stop-color="#2563EB"/>' +
    '<stop offset=".75" stop-color="#7C3AED"/><stop offset="1" stop-color="#D946EF"/>' +
    '</linearGradient></defs>' +
    '<path class="draw" d="M18,94 V54 C18,26 37,11 60,9 C83,11 102,26 102,54 V94" stroke="url(#' + gid + ')" stroke-width="3.2" stroke-linecap="round"/>' +
    '<path d="M34,94 V58 C34,39 45,28 60,26 C75,28 86,39 86,58 V94" stroke="url(#' + gid + ')" stroke-width="1.6" opacity=".4" stroke-linecap="round"/>' +
    '<path d="M10,94 H110" stroke="rgba(248,250,252,.28)" stroke-width="2.4" stroke-linecap="round"/>' +
    '<circle cx="60" cy="9" r="2.6" fill="#D946EF"/>' +
    '<circle r="2.4" fill="#00D9FF"><animateMotion dur="7s" repeatCount="indefinite" ' +
    'path="M18,94 V54 C18,26 37,11 60,9 C83,11 102,26 102,54 V94"/></circle>' +
    '</svg></div>'
  );
}

/** Sparse, slow background particles (Nexus: very low density, must not compete with content). */
function particles(): string {
  const dots: Array<[string, string, string, string, string]> = [
    // x, size, duration, delay, color
    ['12%', '3px', '86s', '0s', 'rgba(0,217,255,0.75)'],
    ['24%', '2px', '102s', '14s', 'rgba(124,58,237,0.8)'],
    ['38%', '2.5px', '94s', '30s', 'rgba(0,217,255,0.6)'],
    ['55%', '2px', '110s', '6s', 'rgba(217,70,239,0.65)'],
    ['68%', '3px', '90s', '42s', 'rgba(37,99,235,0.8)'],
    ['81%', '2px', '104s', '22s', 'rgba(0,217,255,0.7)'],
    ['92%', '2.5px', '98s', '50s', 'rgba(124,58,237,0.7)'],
  ];
  let dx = '-2';
  return (
    '<div class="gz-particles" aria-hidden="true">' +
    dots
      .map(function (d) {
        dx = dx === '-2' ? '2' : '-2';
        return '<i style="--x:' + d[0] + ';--s:' + d[1] + ';--d:' + d[2] + ';--dl:' + d[3] + ';--c:' + d[4] + ';--dx:' + dx + 'vmax"></i>';
      })
      .join('') +
    '</div>'
  );
}

function navIcon(name: string): string {
  const p: Record<string, string> = {
    dash: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
    users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8,20c0-3.5 2.8-5.8 6.2-5.8s6.2,2.3 6.2,5.8"/><path d="M15.8,4.9a3.4,3.4 0 0 1 0,6.4"/><path d="M17.6,14.5c2.3,0.8 3.8,2.8 3.8,5.5"/>',
    set: '<path d="M4,6h9"/><path d="M19,6h1"/><path d="M4,12h3"/><path d="M13,12h7"/><path d="M4,18h12"/><path d="M21,18h-1"/><circle cx="16" cy="6" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="18.5" cy="18" r="2.2"/>',
    menu: '<path d="M4,7h16"/><path d="M4,12h16"/><path d="M4,17h16"/>',
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (p[name] || '') + '</svg>';
}

/** Panel SPA skeleton (Nexus layout). Data injected via window.__GZ__; i18n via data-i18n attrs. */
export function panelBody(gz: {
  panelPath: string; dbOk: boolean; isDefaultPassword: boolean; version: string; lang: string; mock?: boolean; logo: string; favicon: string;
}): string {
  const gzJson = JSON.stringify(gz).replace(/<\//g, '<\\/');
  return `
<div class="gz-bg"></div>
${particles()}

<aside class="sidebar" id="sidebar" aria-label="Gozargah">
  <div class="sb-brand">
    <img src="" alt="Gozargah" id="brand-logo" width="44" height="44">
    <div><b data-i18n="appName">گذرگاه</b><small data-i18n="tagline">دروازهٔ امن عبور</small></div>
  </div>
  <div class="gradline sb-grad"></div>
  <nav class="sb-nav">
    <button class="nav-item on" data-tab="dash" type="button">${navIcon('dash')}<span data-i18n="dashboard">داشبورد</span></button>
    <button class="nav-item" data-tab="users" type="button">${navIcon('users')}<span data-i18n="usersTab">کاربران</span></button>
    <button class="nav-item" data-tab="set" type="button">${navIcon('set')}<span data-i18n="settingsTab">تنظیمات</span></button>
  </nav>
  <div class="sb-foot">
    <span class="vchip" id="ver-chip">v—</span>
    <span class="vchip" id="db-chip"></span>
  </div>
</aside>
<div class="sb-overlay" id="sb-overlay"></div>

<div class="main">
  <header class="topbar">
    <button class="btn icon burger" id="burger" type="button" aria-label="menu" data-aria-menu="1">${navIcon('menu')}</button>
    <h1 class="page-title" id="page-title" data-i18n="dashboard">داشبورد</h1>
    <div class="top-actions">
      <button class="btn sm ghost" id="lang-btn" type="button">English</button>
      <button class="btn sm ghost hidden" id="logout-btn" type="button" data-i18n="logout">خروج</button>
    </div>
  </header>
  <main class="wrap">

    <!-- login -->
    <section id="v-login" class="auth-wrap">
      <div class="auth-card glass">
        ${emblemSvg('', 'login')}
        <h2 data-i18n="appName">گذرگاه</h2>
        <p data-i18n="tagline">دروازهٔ امن عبور</p>
        <div class="auth-err" id="login-err"></div>
        <div class="field">
          <input type="password" id="login-pw" autocomplete="current-password" placeholder="••••••••">
        </div>
        <button class="btn primary" id="login-btn" type="button" style="width:100%" data-i18n="enter">ورود</button>
      </div>
    </section>

    <!-- setup guide (no D1) -->
    <section id="v-setup" class="auth-wrap">
      <div class="glass" style="width:min(560px,94vw);padding:28px">
        <h2 class="gradtext" style="font-size:19px;font-weight:800;margin-bottom:6px" data-i18n="setupTitle">اتصال دیتابیس D1</h2>
        <p style="color:var(--gz-text-muted);font-size:13px" data-i18n="setupDesc"></p>
        <ol class="steps">
          <li data-i18n="setupStep1"></li>
          <li data-i18n="setupStep2"></li>
          <li data-i18n="setupStep3"></li>
          <li data-i18n="setupStep4"></li>
        </ol>
        <button class="btn primary" id="setup-retry" type="button" data-i18n="retry">بررسی مجدد</button>
      </div>
    </section>

    <!-- main -->
    <section id="v-main" class="hidden">
      <div class="hero glass">
        ${emblemSvg('', 'hero')}
        <div>
          <h1><span data-i18n="appName">گذرگاه</span> <span class="gradtext" id="hero-ver"></span></h1>
          <p data-i18n="statsNote"></p>
        </div>
        <div class="sub-chip">
          <div class="chip-row"><span class="lbl" data-i18n="quickSub"></span></div>
          <div class="chip-row" style="margin-top:7px"><span class="val" id="admin-sub">—</span>
            <button class="btn sm" id="admin-sub-copy" type="button" data-i18n="copy">کپی</button></div>
        </div>
      </div>

      <div class="warnbox hidden" id="pw-warn">
        <span aria-hidden="true">⚠️</span><span data-i18n="defaultPwWarn"></span>
        <button class="btn sm" id="pw-warn-go" type="button" data-i18n="changePw"></button>
      </div>

      <!-- dashboard -->
      <div id="tab-dash">
        <div class="stat-grid" id="stat-grid"></div>
        <div class="events glass" style="padding-bottom:6px">
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
            <label data-i18n="resetCycle"></label>
            <select id="s-resetcycle">
              <option value="none" data-i18n="resetNone">خاموش</option>
              <option value="daily" data-i18n="resetDaily">روزانه</option>
              <option value="weekly" data-i18n="resetWeekly">هفتگی</option>
              <option value="monthly" data-i18n="resetMonthly">ماهانه (۳۰ روز)</option>
            </select>
            <div class="hint" data-i18n="resetCycleHint"></div>
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
</div>
<div id="modal-root"></div>
<div id="toasts"></div>
<script>window.__GZ_DICT__ = ${JSON.stringify(DICTS).replace(/<\//g, '<\\/')}; window.__GZ__ = ${gzJson};</script>
<script>
${PANEL_JS}
</script>`;
}
