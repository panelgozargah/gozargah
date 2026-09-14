/**
 * Gozargah — panel page skeleton + the "passage arch" emblem.
 * The arch (Persian caravan gate motif) is the brand signature: a traveler
 * dot passes through the gate — گذرگاه means "passage".
 */

import { PANEL_JS } from './script';
import { DICTS } from './i18n';

export function emblemSvg(cls: string, uid = 'g'): string {
  const gid = 'gza-' + uid;
  return (
    '<div class="emblem ' + cls + '">' +
    '<svg viewBox="0 0 120 104" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<defs><linearGradient id="' + gid + '" x1="18" y1="96" x2="102" y2="8" gradientUnits="userSpaceOnUse">' +
    '<stop stop-color="#2CC9FF"/><stop offset=".52" stop-color="#8B5CF6"/><stop offset="1" stop-color="#C026D3"/>' +
    '</linearGradient></defs>' +
    '<path class="draw" d="M18,94 V54 C18,26 37,11 60,9 C83,11 102,26 102,54 V94" stroke="url(#' + gid + ')" stroke-width="3.2" stroke-linecap="round"/>' +
    '<path d="M34,94 V58 C34,39 45,28 60,26 C75,28 86,39 86,58 V94" stroke="url(#' + gid + ')" stroke-width="1.6" opacity=".4" stroke-linecap="round"/>' +
    '<path d="M10,94 H110" stroke="rgba(255,255,255,.28)" stroke-width="2.4" stroke-linecap="round"/>' +
    '<circle cx="60" cy="9" r="2.6" fill="#C026D3"/>' +
    '<circle r="2.4" fill="#2CC9FF"><animateMotion dur="7s" repeatCount="indefinite" ' +
    'path="M18,94 V54 C18,26 37,11 60,9 C83,11 102,26 102,54 V94"/></circle>' +
    '</svg></div>'
  );
}

/** Panel SPA skeleton. Data injected via window.__GZ__; i18n via data-i18n attrs. */
export function panelBody(gz: {
  panelPath: string; dbOk: boolean; isDefaultPassword: boolean; version: string; lang: string; mock?: boolean; logo: string; favicon: string;
}): string {
  const gzJson = JSON.stringify(gz).replace(/<\//g, '<\\/');
  return `
<div class="gz-bg"></div>
<header class="topbar">
  <div class="topbar-in">
    <div class="brand">
      <img src="" alt="Gozargah" id="brand-logo">
      <div><b data-i18n="appName">گذرگاه</b><small>Gozargah Panel · <span id="ver">—</span></small></div>
    </div>
    <div class="top-actions">
      <span class="vchip" id="db-chip"></span>
      <button class="btn sm ghost" id="lang-btn" type="button">English</button>
      <button class="btn sm ghost hidden" id="logout-btn" type="button" data-i18n="logout">خروج</button>
    </div>
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
  <section id="v-setup" class="hidden" style="padding-top:34px">
    <div class="glass" style="padding:28px">
      <h2 class="gradtext" style="font-size:19px;font-weight:800;margin-bottom:6px" data-i18n="setupTitle">اتصال دیتابیس D1</h2>
      <p style="color:var(--mut);font-size:13px" data-i18n="setupDesc"></p>
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
      <span>⚠️</span><span data-i18n="defaultPwWarn"></span>
      <button class="btn sm" id="pw-warn-go" type="button" data-i18n="changePw"></button>
    </div>

    <nav class="tabs">
      <button class="tab on" data-tab="dash" type="button" data-i18n="dashboard">داشبورد</button>
      <button class="tab" data-tab="users" type="button" data-i18n="usersTab">کاربران</button>
      <button class="tab" data-tab="set" type="button" data-i18n="settingsTab">تنظیمات</button>
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
<script>window.__GZ_DICT__ = ${JSON.stringify(DICTS).replace(/<\//g, '<\\/')}; window.__GZ__ = ${gzJson};</script>
<script>
${PANEL_JS}
</script>`;
}
