/**
 * Gozargah — panel stylesheet (AMOLED + logo gradient identity).
 * Palette from the brand mark: #2CC9FF -> #8B5CF6 -> #C026D3 on #05060A.
 */

export const PANEL_CSS = `
:root{
  --bg:#05060a; --bg2:#0a0d16;
  --card:rgba(255,255,255,.045); --card2:rgba(255,255,255,.07);
  --line:rgba(255,255,255,.09); --line2:rgba(255,255,255,.16);
  --txt:#e9edf6; --mut:#8e97ad; --mut2:#5b6478;
  --c1:#2cc9ff; --c2:#8b5cf6; --c3:#c026d3;
  --ok:#34d399; --warn:#fbbf24; --bad:#fb7185;
  --grad:linear-gradient(120deg,var(--c1),var(--c2) 52%,var(--c3));
  --grad-soft:linear-gradient(120deg,rgba(44,201,255,.16),rgba(139,92,246,.16) 52%,rgba(192,38,211,.16));
  --r-lg:22px; --r-md:16px; --r-sm:11px;
  --shadow:0 18px 50px -18px rgba(0,0,0,.65);
  --glow:0 10px 34px -10px rgba(139,92,246,.55);
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{
  font-family:'Vazirmatn',system-ui,-apple-system,'Segoe UI',sans-serif;
  background:var(--bg);color:var(--txt);min-height:100vh;
  font-size:14.5px;line-height:1.75;
}
.gz-bg{position:fixed;inset:0;z-index:-1;background:var(--bg);overflow:hidden}
.gz-bg::before{content:'';position:absolute;width:56vmax;height:56vmax;top:-22vmax;inset-inline-start:-14vmax;border-radius:50%;
  background:radial-gradient(circle,rgba(44,201,255,.13),transparent 62%);filter:blur(30px);animation:drift 26s ease-in-out infinite alternate}
.gz-bg::after{content:'';position:absolute;width:52vmax;height:52vmax;bottom:-24vmax;inset-inline-end:-12vmax;border-radius:50%;
  background:radial-gradient(circle,rgba(192,38,211,.12),transparent 62%);filter:blur(34px);animation:drift 32s ease-in-out infinite alternate-reverse}
@keyframes drift{from{transform:translate(0,0) scale(1)}to{transform:translate(6vmax,4vmax) scale(1.12)}}

.wrap{max-width:1060px;margin:0 auto;padding:0 18px 80px}
.topbar{position:sticky;top:0;z-index:50;backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
  background:rgba(5,6,10,.72);border-bottom:1px solid var(--line)}
.topbar-in{max-width:1060px;margin:0 auto;padding:12px 18px;display:flex;align-items:center;gap:14px}
.brand{display:flex;align-items:center;gap:12px;min-width:0}
.brand img{width:42px;height:42px;border-radius:12px;box-shadow:0 0 0 1px var(--line2),0 8px 24px -8px rgba(139,92,246,.5)}
.brand b{font-size:17px;font-weight:800;letter-spacing:.2px;display:block;line-height:1.3}
.brand small{color:var(--mut);font-size:11.5px;display:block}
.top-actions{margin-inline-start:auto;display:flex;gap:9px;align-items:center}
.vchip{font-size:11px;color:var(--mut);border:1px solid var(--line);padding:3px 10px;border-radius:99px;white-space:nowrap}

.glass{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:var(--shadow)}
.gradline{height:2px;background:var(--grad);border-radius:99px;opacity:.9}
.gradtext{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;cursor:pointer;
  font-family:inherit;font-size:13.5px;font-weight:700;padding:10px 20px;border-radius:var(--r-sm);
  color:var(--txt);background:var(--card2);border:1px solid var(--line);transition:all .18s ease;user-select:none}
.btn:hover{border-color:var(--line2);background:rgba(255,255,255,.1)}
.btn:active{transform:scale(.97)}
.btn.primary{background:var(--grad);color:#07080f;border:none;box-shadow:var(--glow)}
.btn.primary:hover{filter:brightness(1.1);transform:translateY(-1px)}
.btn.danger{color:var(--bad);border-color:rgba(251,113,133,.35)}
.btn.danger:hover{background:rgba(251,113,133,.12)}
.btn.ghost{background:transparent}
.btn.sm{padding:6px 13px;font-size:12.5px;border-radius:9px}
.btn.icon{padding:8px 10px}

/* fields */
.field{margin-bottom:16px}
.field label{display:block;font-size:12.5px;color:var(--mut);margin-bottom:7px;font-weight:600}
.field .hint{font-size:11px;color:var(--mut2);margin-top:5px}
input[type=text],input[type=password],input[type=number],input[type=date],input[type=datetime-local],textarea{
  width:100%;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:var(--r-sm);
  color:var(--txt);font-family:inherit;font-size:13.5px;padding:10px 14px;outline:none;transition:border .18s, box-shadow .18s}
textarea{resize:vertical;min-height:84px;direction:ltr;text-align:left;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
input:focus,textarea:focus{border-color:rgba(44,201,255,.55);box-shadow:0 0 0 3px rgba(44,201,255,.14)}
input.mono{direction:ltr;text-align:left;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}

/* login */
.auth-wrap{min-height:calc(100vh - 70px);display:flex;align-items:center;justify-content:center;padding:30px 0}
.auth-card{width:min(420px,94vw);padding:34px 30px 28px;text-align:center;position:relative;overflow:hidden}
.auth-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--grad)}
.auth-card .emblem{width:92px;margin:0 auto 6px}
.auth-card h2{font-size:20px;font-weight:800;margin-bottom:2px}
.auth-card p{color:var(--mut);font-size:12.5px;margin-bottom:22px}
.auth-err{color:var(--bad);font-size:12px;min-height:18px;margin-bottom:6px}

/* tabs */
.tabs{display:flex;gap:4px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:5px;margin:22px 0 20px;position:relative}
.tab{flex:1;text-align:center;padding:9px 6px;border-radius:10px;cursor:pointer;color:var(--mut);font-weight:700;font-size:13.5px;transition:all .18s;border:none;background:none;font-family:inherit}
.tab:hover{color:var(--txt)}
.tab.on{color:#07080f;background:var(--grad);box-shadow:var(--glow)}

/* hero + stats */
.hero{display:flex;align-items:center;gap:18px;padding:24px 26px;margin-bottom:16px;position:relative;overflow:hidden}
.hero .emblem{width:74px;flex-shrink:0}
.hero h1{font-size:21px;font-weight:800}
.hero p{color:var(--mut);font-size:12.5px}
.hero .sub-chip{margin-inline-start:auto;max-width:46%}
@media(max-width:720px){.hero{flex-direction:column;text-align:center}.hero .sub-chip{margin:0;max-width:100%;width:100%}}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px}
.stat{padding:16px 18px;border-radius:var(--r-md);background:var(--card);border:1px solid var(--line)}
.stat .k{font-size:11.5px;color:var(--mut);margin-bottom:6px;font-weight:600}
.stat .v{font-size:19px;font-weight:800}
.stat .v small{font-size:11px;color:var(--mut);font-weight:400}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-inline-end:6px;vertical-align:1px}
.dot.ok{background:var(--ok);box-shadow:0 0 8px var(--ok)}
.dot.bad{background:var(--bad);box-shadow:0 0 8px var(--bad)}
.warnbox{display:flex;gap:10px;align-items:center;padding:13px 16px;border-radius:var(--r-md);margin-bottom:16px;
  background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);color:#fde68a;font-size:12.5px}

/* link chips */
.chip-row{display:flex;gap:9px;align-items:center;background:rgba(255,255,255,.035);border:1px solid var(--line);
  border-radius:var(--r-sm);padding:9px 12px;min-width:0}
.chip-row .lbl{font-size:11px;color:var(--mut);white-space:nowrap;font-weight:700}
.chip-row .val{flex:1;direction:ltr;text-align:left;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#bcd3ea;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}

/* user cards */
.users-head{display:flex;align-items:center;margin-bottom:14px;gap:10px}
.users-head h3{font-size:16px;font-weight:800}
.users-head .btn{margin-inline-start:auto}
.user-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.ucard{padding:18px;display:flex;flex-direction:column;gap:10px;transition:transform .18s,border-color .18s;position:relative}
.ucard:hover{transform:translateY(-2px);border-color:var(--line2)}
.ucard .row1{display:flex;align-items:center;gap:9px}
.ucard .uname{font-weight:800;font-size:15px}
.badge{font-size:10px;padding:2px 9px;border-radius:99px;background:var(--grad-soft);border:1px solid rgba(139,92,246,.4);color:#d8c9ff;font-weight:700}
.chip{font-size:10.5px;padding:2px 9px;border-radius:99px;font-weight:700;border:1px solid var(--line)}
.chip.ok{color:var(--ok);border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.08)}
.chip.warn{color:var(--warn);border-color:rgba(251,191,36,.4);background:rgba(251,191,36,.08)}
.chip.bad{color:var(--bad);border-color:rgba(251,113,133,.4);background:rgba(251,113,133,.08)}
.ucard .meta{font-size:11.5px;color:var(--mut);display:flex;flex-wrap:wrap;gap:4px 14px}
.pbar{height:7px;border-radius:99px;background:rgba(255,255,255,.06);overflow:hidden}
.pbar i{display:block;height:100%;background:var(--grad);border-radius:99px;box-shadow:0 0 10px rgba(139,92,246,.6);transition:width .5s ease}
.ucard .btns{display:flex;gap:7px;flex-wrap:wrap}

/* setup */
.steps{counter-reset:s;list-style:none;display:flex;flex-direction:column;gap:12px;margin:18px 0}
.steps li{counter-increment:s;display:flex;gap:13px;align-items:flex-start;background:var(--card);border:1px solid var(--line);
  border-radius:var(--r-md);padding:14px 16px;font-size:13px}
.steps li::before{content:counter(s);flex-shrink:0;width:27px;height:27px;border-radius:9px;background:var(--grad);
  color:#07080f;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:13px;margin-top:2px}

/* events */
.events{margin-top:20px}
.events h4{font-size:13px;color:var(--mut);margin-bottom:9px;font-weight:700}
.ev{display:flex;gap:10px;font-size:11.5px;color:var(--mut);padding:7px 12px;border-bottom:1px dashed var(--line)}
.ev b{color:var(--txt);font-weight:600}
.ev time{margin-inline-start:auto;direction:ltr;color:var(--mut2);font-size:10.5px}

/* modal */
.modal-bg{position:fixed;inset:0;background:rgba(3,4,8,.7);backdrop-filter:blur(6px);z-index:100;
  display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .18s ease}
.modal{width:min(560px,96vw);max-height:88vh;overflow:auto;padding:24px;animation:popIn .22s cubic-bezier(.2,.9,.3,1.2)}
.modal h3{font-size:16px;font-weight:800;margin-bottom:16px}
.modal .close-x{float:inset-inline-end}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes popIn{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:none}}

/* toasts */
#toasts{position:fixed;bottom:20px;inset-inline-start:20px;z-index:200;display:flex;flex-direction:column;gap:9px}
.toast{background:rgba(13,16,26,.92);border:1px solid var(--line2);border-radius:13px;padding:11px 17px;font-size:13px;
  box-shadow:var(--shadow);animation:toastIn .25s cubic-bezier(.2,.9,.3,1.15);max-width:320px;border-inline-start:3px solid var(--c1)}
.toast.err{border-inline-start-color:var(--bad)}
.toast.ok{border-inline-start-color:var(--ok)}
@keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}

/* emblem */
.emblem svg{display:block;width:100%;height:auto}
.emblem .draw{stroke-dasharray:340;stroke-dashoffset:340;animation:draw 1.5s ease forwards .2s}
@keyframes draw{to{stroke-dashoffset:0}}

/* scrollbars */
::-webkit-scrollbar{width:9px;height:9px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:99px}
::-webkit-scrollbar-track{background:transparent}

.hidden{display:none !important}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:640px){.two-col{grid-template-columns:1fr}}
[dir=ltr] .val{text-align:left}
a{color:var(--c1)}
`;
