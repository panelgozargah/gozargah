/**
 * Gozargah — panel stylesheet implementing the "Gozargah Nexus UI" design system.
 *
 * Source of truth: Gozargah_Nexus_UI_Theme.json (v1.0)
 *  - dark cinematic base #050816, surfaces #080B1A / #0D1224 / #111936
 *  - brand: cyan #00D9FF, blue #2563EB, purple #7C3AED, magenta #D946EF
 *  - brand gradient 135deg cyan→blue→purple→magenta
 *  - glassmorphism rgba(255,255,255,.035) + 18px blur, card radius 18px, controls 12px
 *  - 250px sidebar (drawer on mobile), fine grid + ambient glow + sparse slow particles
 *  - motion 180-250ms, reduced-motion respected, visible focus states
 */

export const PANEL_CSS = `
:root{
  /* --- Gozargah Nexus UI: color system (exact theme tokens) --- */
  --gz-bg:#050816;
  --gz-surface:#080B1A;
  --gz-surface-elevated:#0D1224;
  --gz-surface-hover:#111936;
  --gz-cyan:#00D9FF;
  --gz-blue:#2563EB;
  --gz-purple:#7C3AED;
  --gz-magenta:#D946EF;
  --gz-text:#F8FAFC;
  --gz-text-secondary:#CBD5E1;
  --gz-text-muted:#94A3B8;
  --gz-text-disabled:#64748B;
  --gz-ok:#22C55E; --gz-warning:#F59E0B; --gz-danger:#EF4444; --gz-info:#38BDF8;
  --gz-border:rgba(148,163,184,0.12);
  --gz-border-brand:rgba(0,217,255,0.20);
  --gz-border-active:rgba(124,58,237,0.35);
  --gz-grad:linear-gradient(135deg,#00D9FF 0%,#2563EB 45%,#7C3AED 75%,#D946EF 100%);
  --gz-grad-subtle:linear-gradient(135deg,rgba(0,217,255,0.10),rgba(124,58,237,0.10));

  /* --- shape & spacing --- */
  --gz-radius-card:18px;
  --gz-radius-control:12px;
  --gz-radius-sm:10px;
  --gz-space:4px;
  --gz-glass-bg:rgba(255,255,255,0.035);
  --gz-glass-border:1px solid rgba(255,255,255,0.08);
  --gz-glass-blur:18px;
  --gz-shadow:0 12px 40px rgba(0,0,0,0.25);
  --gz-glow:0 8px 28px -8px rgba(37,99,235,0.45);
  --gz-sidebar-w:250px;
  --gz-dur:200ms;

  /* --- legacy aliases (kept for landing/composed snippets) --- */
  --bg:var(--gz-bg); --bg2:var(--gz-surface);
  --card:var(--gz-glass-bg); --card2:rgba(255,255,255,0.07);
  --line:var(--gz-border); --line2:rgba(255,255,255,0.16);
  --txt:var(--gz-text); --mut:var(--gz-text-muted); --mut2:var(--gz-text-disabled);
  --c1:var(--gz-cyan); --c2:var(--gz-purple); --c3:var(--gz-magenta);
  --ok:var(--gz-ok); --warn:var(--gz-warning); --bad:var(--gz-danger);
  --grad:var(--gz-grad); --r-lg:var(--gz-radius-card); --r-md:var(--gz-radius-control); --r-sm:var(--gz-radius-sm);
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{
  font-family:'Inter','Vazirmatn',system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;
  background:var(--gz-bg);color:var(--gz-text);min-height:100vh;
  font-size:14px;line-height:1.7;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}

/* ============ background effects: grid + ambient glow + particles ============ */
.gz-bg{position:fixed;inset:0;z-index:-2;background:var(--gz-bg);overflow:hidden}
.gz-bg::before{content:'';position:absolute;inset:0;
  background:
    repeating-linear-gradient(0deg,rgba(148,163,184,0.045) 0 1px,transparent 1px 44px),
    repeating-linear-gradient(90deg,rgba(148,163,184,0.045) 0 1px,transparent 1px 44px);
  -webkit-mask-image:radial-gradient(ellipse 90% 80% at 50% 30%,#000 30%,transparent 100%);
  mask-image:radial-gradient(ellipse 90% 80% at 50% 30%,#000 30%,transparent 100%);}
.gz-bg::after{content:'';position:absolute;inset:0;
  background:
    radial-gradient(46vmax 46vmax at 8% -6%,rgba(0,217,255,0.10),transparent 62%),
    radial-gradient(50vmax 50vmax at 96% 108%,rgba(124,58,237,0.11),transparent 62%);
  animation:gzBreathe 18s ease-in-out infinite alternate}
@keyframes gzBreathe{from{opacity:.75}to{opacity:1}}
.gz-particles{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden}
.gz-particles i{position:absolute;bottom:-3vh;inset-inline-start:var(--x,50%);width:var(--s,3px);height:var(--s,3px);
  border-radius:50%;background:var(--c,rgba(0,217,255,0.8));opacity:0;filter:blur(.4px);
  animation:gzFloat var(--d,80s) linear var(--dl,0s) infinite}
@keyframes gzFloat{
  0%{transform:translate3d(0,0,0);opacity:0}
  8%{opacity:.45}
  88%{opacity:.18}
  100%{transform:translate3d(var(--dx,3vmax),-106vh,0);opacity:0}}

/* ============ layout: sidebar + main ============ */
.sidebar{position:fixed;top:0;bottom:0;inset-inline-start:0;width:var(--gz-sidebar-w);z-index:80;
  display:flex;flex-direction:column;gap:6px;padding:20px 14px 16px;
  background:rgba(8,11,26,0.82);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border-inline-end:1px solid var(--gz-border)}
.sb-brand{display:flex;align-items:center;gap:12px;padding:4px 8px 14px}
.sb-brand img{width:44px;height:44px;border-radius:13px;flex-shrink:0;
  box-shadow:0 0 0 1px var(--gz-border-brand),0 10px 32px -10px rgba(124,58,237,0.55)}
.sb-brand b{font-size:16.5px;font-weight:800;letter-spacing:.2px;display:block;line-height:1.35}
.sb-brand small{color:var(--gz-text-muted);font-size:11px;display:block}
.sb-grad{margin:0 4px 10px}
.sb-nav{display:flex;flex-direction:column;gap:4px;flex:1}
.nav-item{position:relative;display:flex;align-items:center;gap:11px;width:100%;
  padding:10px 14px;border:none;background:none;cursor:pointer;font-family:inherit;
  color:var(--gz-text-muted);font-size:13.5px;font-weight:600;text-align:start;
  border-radius:var(--gz-radius-control);transition:background var(--gz-dur) ease,color var(--gz-dur) ease,box-shadow var(--gz-dur) ease}
.nav-item svg{width:19px;height:19px;flex-shrink:0;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.nav-item:hover{background:var(--gz-surface-hover);color:var(--gz-text-secondary)}
.nav-item.on{color:var(--gz-text);background:var(--gz-grad-subtle);
  box-shadow:inset 0 0 0 1px var(--gz-border-brand),0 8px 24px -12px rgba(124,58,237,0.5)}
.nav-item.on::before{content:'';position:absolute;inset-inline-start:0;top:22%;bottom:22%;width:3px;border-radius:99px;background:var(--gz-grad)}
.nav-item:focus-visible{outline:2px solid rgba(0,217,255,.7);outline-offset:2px}
.sb-foot{display:flex;flex-wrap:wrap;gap:6px;padding:12px 6px 0;border-top:1px solid var(--gz-border)}

.sb-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.68);backdrop-filter:blur(4px);z-index:70;
  opacity:0;pointer-events:none;transition:opacity var(--gz-dur) ease}
.main{min-height:100vh}
body[data-view="main"] .main{margin-inline-start:var(--gz-sidebar-w)}

/* ============ topbar ============ */
.topbar{position:sticky;top:0;z-index:60;display:none;align-items:center;gap:12px;
  padding:14px 24px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  background:rgba(5,8,22,0.72);border-bottom:1px solid var(--gz-border)}
body[data-view="main"] .topbar{display:flex}
.page-title{font-size:17px;font-weight:800;letter-spacing:.2px}
.top-actions{margin-inline-start:auto;display:flex;gap:9px;align-items:center}
.burger{display:none}
.vchip{font-size:11px;color:var(--gz-text-muted);border:1px solid var(--gz-border);
  padding:3px 10px;border-radius:99px;white-space:nowrap;background:var(--gz-glass-bg)}

/* ============ content wrap ============ */
.wrap{max-width:1600px;margin:0 auto;padding:0 24px 80px}
body:not([data-view="main"]) .wrap{padding-top:0}
body[data-view="main"] .wrap{padding-top:24px}
@media(max-width:720px){.wrap{padding:0 16px 64px}body[data-view="main"] .wrap{padding-top:16px}}
@media(max-width:1023px){
  body[data-view="main"] .main{margin-inline-start:0}
  .sidebar{transform:translateX(var(--sb-hide,-110%));transition:transform 240ms cubic-bezier(.2,.8,.25,1)}
  [dir="rtl"] .sidebar{--sb-hide:110%}
  .sidebar.open{transform:translateX(0)}
  .sb-overlay.show{opacity:1;pointer-events:auto}
  .burger{display:inline-flex}
}

/* ============ glass & gradient primitives ============ */
.glass{background:var(--gz-glass-bg);border:var(--gz-glass-border);border-radius:var(--gz-radius-card);
  backdrop-filter:blur(var(--gz-glass-blur));-webkit-backdrop-filter:blur(var(--gz-glass-blur));box-shadow:var(--gz-shadow)}
.gradline{height:2px;background:var(--gz-grad);border-radius:99px;opacity:.9}
.gradtext{background:var(--gz-grad);-webkit-background-clip:text;background-clip:text;color:transparent}

/* ============ buttons ============ */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;cursor:pointer;
  font-family:inherit;font-size:13.5px;font-weight:600;padding:10px 20px;border-radius:var(--gz-radius-control);
  color:var(--gz-text-secondary);background:var(--gz-glass-bg);border:1px solid rgba(148,163,184,0.14);
  transition:all var(--gz-dur) ease;user-select:none}
.btn:hover{border-color:var(--gz-border-brand);background:var(--gz-surface-hover);color:var(--gz-text)}
.btn:active{transform:scale(.97)}
.btn:focus-visible{outline:2px solid rgba(0,217,255,.7);outline-offset:2px}
.btn.primary{background:var(--gz-grad);color:#FFFFFF;border:none;box-shadow:var(--gz-glow)}
.btn.primary:hover{filter:brightness(1.1);transform:translateY(-1px);color:#fff}
.btn.danger{color:var(--gz-danger);border-color:rgba(239,68,68,.32)}
.btn.danger:hover{background:rgba(239,68,68,.10);border-color:rgba(239,68,68,.5);color:var(--gz-danger)}
.btn.ghost{background:transparent;border-color:transparent}
.btn.ghost:hover{background:var(--gz-surface-hover)}
.btn.sm{padding:6px 13px;font-size:12.5px;border-radius:var(--gz-radius-sm)}
.btn.icon{padding:8px 10px}

/* ============ fields ============ */
.field{margin-bottom:16px}
.field label{display:block;font-size:12.5px;color:var(--gz-text-muted);margin-bottom:7px;font-weight:600}
.field .hint{font-size:11px;color:var(--gz-text-disabled);margin-top:5px}
input[type=text],input[type=password],input[type=number],input[type=date],input[type=datetime-local],textarea,select{
  width:100%;background:var(--gz-glass-bg);border:1px solid rgba(148,163,184,0.14);border-radius:var(--gz-radius-control);
  color:var(--gz-text);font-family:inherit;font-size:13.5px;padding:10px 14px;outline:none;
  transition:border var(--gz-dur),box-shadow var(--gz-dur)}
select{cursor:pointer;-webkit-appearance:none;appearance:none;
  background-image:linear-gradient(45deg,transparent 50%,var(--gz-text-muted) 50%),linear-gradient(135deg,var(--gz-text-muted) 50%,transparent 50%);
  background-position:calc(0% + 16px) calc(50% + 1px),calc(0% + 21px) calc(50% + 1px);
  background-size:5px 5px,5px 5px;background-repeat:no-repeat}
html[dir="rtl"] select{padding-inline-start:40px}
html[dir="ltr"] select{padding-inline-end:40px;background-position:calc(100% - 16px) calc(50% + 1px),calc(100% - 21px) calc(50% + 1px)}
select option{background:#0B1020;color:#F1F5F9}
input::placeholder,textarea::placeholder{color:var(--gz-text-disabled)}
textarea{resize:vertical;min-height:84px;direction:ltr;text-align:left;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
input:focus,textarea:focus,select:focus{border-color:rgba(0,217,255,.55);
  box-shadow:0 0 0 3px rgba(0,217,255,.12),0 0 24px -8px rgba(124,58,237,.45)}
input.mono{direction:ltr;text-align:left;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}

/* ============ auth (login) ============ */
body[data-view="login"] .topbar,body[data-view="setup"] .topbar{display:none}
body[data-view="login"] .sidebar,body[data-view="setup"] .sidebar{display:none}
body[data-view="login"] .sb-overlay,body[data-view="setup"] .sb-overlay{display:none}
.auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:30px 16px}
.auth-card{width:min(420px,94vw);padding:36px 30px 30px;text-align:center;position:relative;overflow:hidden}
.auth-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--gz-grad)}
.auth-card::after{content:'';position:absolute;top:-70px;inset-inline-start:50%;transform:translateX(-50%);
  width:260px;height:140px;background:radial-gradient(ellipse,rgba(0,217,255,0.12),transparent 70%);pointer-events:none}
.auth-card .emblem{width:92px;margin:0 auto 6px;position:relative}
.auth-card h2{font-size:20px;font-weight:800;margin-bottom:2px}
.auth-card p{color:var(--gz-text-muted);font-size:12.5px;margin-bottom:22px}
.auth-err{color:var(--gz-danger);font-size:12px;min-height:18px;margin-bottom:6px}

/* ============ setup steps ============ */
.steps{counter-reset:s;list-style:none;display:flex;flex-direction:column;gap:12px;margin:18px 0}
.steps li{counter-increment:s;display:flex;gap:13px;align-items:flex-start;background:var(--gz-glass-bg);
  border:1px solid var(--gz-border);border-radius:var(--gz-radius-control);padding:14px 16px;font-size:13px;color:var(--gz-text-secondary)}
.steps li::before{content:counter(s);flex-shrink:0;width:27px;height:27px;border-radius:var(--gz-radius-sm);
  background:var(--gz-grad);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:13px;margin-top:2px}

/* ============ hero + stats ============ */
.hero{display:flex;align-items:center;gap:18px;padding:24px 26px;margin-bottom:16px;position:relative;overflow:hidden}
.hero::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(120deg,rgba(0,217,255,0.05),transparent 40%,rgba(124,58,237,0.06))}
.hero .emblem{width:72px;flex-shrink:0;position:relative}
.hero h1{font-size:21px;font-weight:800}
.hero p{color:var(--gz-text-muted);font-size:12.5px}
.hero .sub-chip{margin-inline-start:auto;max-width:46%}
@media(max-width:720px){.hero{flex-direction:column;text-align:center}.hero .sub-chip{margin:0;max-width:100%;width:100%}}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:16px}
.stat{padding:18px;border-radius:var(--gz-radius-card);background:var(--gz-glass-bg);border:var(--gz-glass-border);
  backdrop-filter:blur(var(--gz-glass-blur));-webkit-backdrop-filter:blur(var(--gz-glass-blur));
  transition:transform var(--gz-dur) ease,box-shadow var(--gz-dur) ease,border-color var(--gz-dur) ease}
.stat:hover{transform:translateY(-2px);border-color:var(--gz-border-brand);box-shadow:var(--gz-shadow),0 0 24px -10px rgba(0,217,255,0.35)}
.stat .k{font-size:11px;color:var(--gz-text-muted);margin-bottom:7px;font-weight:600;letter-spacing:.4px}
.stat .v{font-size:20px;font-weight:800;color:var(--gz-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stat .v small{font-size:11px;color:var(--gz-text-muted);font-weight:400}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-inline-end:6px;vertical-align:1px;border:1px solid transparent}
.dot.ok{background:var(--gz-ok);box-shadow:0 0 8px rgba(34,197,94,.7);border-color:rgba(34,197,94,.4)}
.dot.bad{background:var(--gz-danger);box-shadow:0 0 8px rgba(239,68,68,.7);border-color:rgba(239,68,68,.4)}
.warnbox{display:flex;gap:10px;align-items:center;padding:13px 16px;border-radius:var(--gz-radius-control);margin-bottom:16px;
  background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);color:#FDE68A;font-size:12.5px}

/* ============ link chips ============ */
.chip-row{display:flex;gap:9px;align-items:center;background:var(--gz-glass-bg);border:1px solid var(--gz-border);
  border-radius:var(--gz-radius-sm);padding:9px 12px;min-width:0}
.chip-row .lbl{font-size:11px;color:var(--gz-text-muted);white-space:nowrap;font-weight:700}
.chip-row .val{flex:1;direction:ltr;text-align:left;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--gz-info);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}

/* ============ user cards ============ */
.users-head{display:flex;align-items:center;margin-bottom:14px;gap:10px}
.users-head h3{font-size:16px;font-weight:800}
.users-head .btn{margin-inline-start:auto}
.user-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.ucard{padding:18px;display:flex;flex-direction:column;gap:10px;position:relative;
  transition:transform var(--gz-dur) ease,border-color var(--gz-dur) ease,box-shadow var(--gz-dur) ease}
.ucard:hover{transform:translateY(-2px);border-color:var(--gz-border-brand);
  box-shadow:var(--gz-shadow),0 10px 32px -14px rgba(124,58,237,0.45)}
.ucard .row1{display:flex;align-items:center;gap:9px}
.ucard .uname{font-weight:800;font-size:15px}
.badge{font-size:10px;padding:2px 9px;border-radius:99px;background:var(--gz-grad-subtle);
  border:1px solid var(--gz-border-active);color:#D8B4FE;font-weight:700}
.chip{font-size:10.5px;padding:2px 9px;border-radius:99px;font-weight:700;border:1px solid var(--gz-border)}
.chip.ok{color:var(--gz-ok);border-color:rgba(34,197,94,.4);background:rgba(34,197,94,.08)}
.chip.warn{color:var(--gz-warning);border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.08)}
.chip.bad{color:var(--gz-danger);border-color:rgba(239,68,68,.4);background:rgba(239,68,68,.08)}
.ucard .meta{font-size:11.5px;color:var(--gz-text-muted);display:flex;flex-wrap:wrap;gap:4px 14px}
.pbar{height:7px;border-radius:99px;background:rgba(255,255,255,0.06);overflow:hidden}
.pbar i{display:block;height:100%;background:var(--gz-grad);border-radius:99px;
  box-shadow:0 0 12px rgba(37,99,235,0.55);transition:width .5s ease}
.ucard .btns{display:flex;gap:7px;flex-wrap:wrap}

/* ============ events (minimal dark table) ============ */
.events{margin-top:20px}
.events h4{font-size:13px;color:var(--gz-text-secondary);margin-bottom:9px;font-weight:700;
  padding:10px 14px;background:rgba(255,255,255,0.045);border-bottom:1px solid var(--gz-border);border-radius:var(--gz-radius-card) var(--gz-radius-card) 0 0}
.ev{display:grid;grid-template-columns:auto 1fr auto;gap:12px;font-size:11.5px;color:var(--gz-text-muted);
  padding:9px 14px;border-bottom:1px solid rgba(148,163,184,0.07);transition:background var(--gz-dur) ease}
.ev:last-child{border-bottom:none}
.ev:hover{background:rgba(255,255,255,0.025)}
.ev b{color:var(--gz-text-secondary);font-weight:600}
.ev time{direction:ltr;color:var(--gz-text-disabled);font-size:10.5px}

/* ============ modal ============ */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.68);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:100;
  display:flex;align-items:center;justify-content:center;padding:20px;animation:gzFadeIn 180ms ease}
.modal{width:min(560px,96vw);max-height:88vh;overflow:auto;padding:24px;background:var(--gz-surface-elevated);
  border:1px solid rgba(255,255,255,0.08);border-radius:var(--gz-radius-card);box-shadow:var(--gz-shadow);
  animation:gzPopIn 220ms cubic-bezier(.2,.9,.3,1.12)}
.modal h3{font-size:16px;font-weight:800;margin-bottom:16px}
.modal .close-x{float:inset-inline-end}
@keyframes gzFadeIn{from{opacity:0}to{opacity:1}}
@keyframes gzPopIn{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:none}}

/* ============ toasts (top-right LTR / top-left RTL via inset-inline-end) ============ */
#toasts{position:fixed;top:20px;inset-inline-end:20px;z-index:200;display:flex;flex-direction:column;gap:9px}
.toast{background:rgba(13,18,36,0.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  border:1px solid var(--gz-border);border-radius:var(--gz-radius-control);padding:11px 17px;font-size:13px;
  color:var(--gz-text-secondary);box-shadow:var(--gz-shadow);animation:gzToastIn 220ms cubic-bezier(.2,.9,.3,1.12);
  max-width:320px;border-inline-start:3px solid var(--gz-cyan)}
.toast.err{border-inline-start-color:var(--gz-danger)}
.toast.ok{border-inline-start-color:var(--gz-ok)}
@keyframes gzToastIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}

/* ============ emblem (passage arch) ============ */
.emblem svg{display:block;width:100%;height:auto}
.emblem .draw{stroke-dasharray:340;stroke-dashoffset:340;animation:gzDraw 1.5s ease forwards .2s}
@keyframes gzDraw{to{stroke-dashoffset:0}}

/* ============ misc ============ */
::-webkit-scrollbar{width:9px;height:9px}
::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.18);border-radius:99px}
::-webkit-scrollbar-thumb:hover{background:rgba(148,163,184,0.28)}
::-webkit-scrollbar-track{background:transparent}
.hidden{display:none !important}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:640px){.two-col{grid-template-columns:1fr}}
[dir=ltr] .val{text-align:left}
a{color:var(--gz-cyan)}
a:focus-visible{outline:2px solid rgba(0,217,255,.7);outline-offset:2px}
::selection{background:rgba(37,99,235,0.4)}

/* ============ accessibility: reduced motion ============ */
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important}
  .gz-particles{display:none}
  .emblem .draw{stroke-dashoffset:0;animation:none}
}
`;
