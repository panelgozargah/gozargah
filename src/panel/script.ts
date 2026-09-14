/**
 * Gozargah — panel client script (vanilla JS, zero deps, injected into the SPA).
 * String.raw keeps backslashes intact; no backticks / ${} inside.
 */

export const PANEL_JS = String.raw`
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
