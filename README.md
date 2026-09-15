<div align="center">

<img src="docs/logo.png" alt="Gozargah" width="140">

# گذرگاه — Gozargah

**دروازهٔ امن عبور — پنل پروکسی چندکاربره روی Cloudflare Workers**

[![Version](https://img.shields.io/badge/version-1.1.0-00D9FF?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563EB?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Cloudflare%20Workers-7C3AED?style=flat-square)](#)
[![Storage](https://img.shields.io/badge/storage-Cloudflare%20D1-D946EF?style=flat-square)](#)
[![UI](https://img.shields.io/badge/UI-Gozargah%20Nexus-050816?style=flat-square)](#-رابط-کاربری)

*VLESS + Trojan over WebSocket · Real byte accounting · Beautiful FA/EN RTL panel · Zero runtime dependencies*

</div>

---

## ✨ معرفی

**گذرگاه** یک پنل پروکسی کامل روی Cloudflare Workers است که با تمرکز بر **معماری ماژولار**، **امنیت واقعی** و **حسابداری دقیق بایت** طراحی شده و هیچ‌کدام از آنتی‌پترن‌های رایج این حوزه را تکرار نمی‌کند.

## 🧬 معماری ماژولار

| لایه | پیاده‌سازی در گذرگاه |
|------|------------------------|
| ساختار کد | TypeScript ماژولار + build تک‌فایلی |
| دیتا-پلین | dial مستقیم → زنجیرهٔ fallback پروکسی‌آی‌پی، انتخاب پایدار per-user |
| ذخیره‌سازی | **D1 رابطه‌ای** (users / events / throttle / kv_store) با کش in-isolate و promise-dedup |
| حسابداری | **بایت واقعی** از طول chunkها + flush دسته‌ای (coalescing) |
| چندکاربره | سهمیه بایت، انقضا، فعال/غیرفعال، چرخش اعتبار |
| امنیت | **PBKDF2-SHA256 (۱۰۰هزار دور)**، سشن HMAC امضاشده با انقضا، rate-limit پایدار در D1 |
| استتار | هر مسیر ناشناخته → صفحهٔ بی‌ضرر؛ `robots.txt` بسته؛ پنل فقط با مسیر مخفی |
| اشتراک | تولید کامل درون Worker (بدون subconverter ثالث) — Base64 / Clash-Meta / Sing-box |
| هدرهای کلاینت | `Subscription-Userinfo` با **عدد واقعی**، نه نمایشی |

### چرا گذرگاه متفاوت است؟

- ❌ رمز plaintext در KV ندارد → **PBKDF2 با salt تصادفی**
- ❌ کوکی سشن = هش رمز ندارد → **توکن HMAC با انقضای ۷ روزه** (تغییر رمز، همهٔ سشن‌ها را می‌کُشد)
- ❌ «GB قلابی» (تعداد کانکشن ÷ ۶۰۰۰) ندارد → **شمارش بایت واقعی up/down**
- ❌ rate-limit فرّار per-isolate ندارد → **قفل ورود ماندگار در D1**
- ❌ وابستگی رانتایم به raw.githubusercontent یا سرویس QR ثالث ندارد → **همه‌چیز embed شده**
- ❌ race در JSON-blob ندارد → **قفل خوش‌بینانه (rev) روی تنظیمات + جدول رابطه‌ای کاربران**

## 🎨 رابط کاربری — Gozargah Nexus UI

رابط پنل با دیزاین‌سیستم اختصاصی **Gozargah Nexus UI** ساخته شده: تم سینمایی تیره روی `#050816`، گرادیان برند Cyan→Blue→Purple→Magenta، گلس‌مورفیسم ظریف، سایدبار شیشه‌ای ۲۵۰px (در موبایل: دراور با overlay)، تایپوگرافی Inter + Vazirmatn، گرید فیوچریستیک و ذرات بسیار کم‌تراکم در پس‌زمینه.

| ویژگی | جزئیات |
|--------|--------|
| چیدمان | سایدبار ثابت دسکتاپ ← دراور کشویی موبایل (کلیک بیرون/Esc می‌بندد) |
| RTL/LTR | فارسی پیش‌فرض RTL، انگلیسی LTR — سایدبار و توست‌ها با پراپرتی‌های منطقی جابه‌جا می‌شوند |
| حرکت | ترنزیشن‌های ۱۸۰–۲۵۰ms؛ با `prefers-reduced-motion` همهٔ انیمیشن‌ها غیرفعال می‌شوند |
| دسترس‌پذیری | حالت فوکوس واضح (`:focus-visible`)، وضعیت‌ها بدون اتکای صرف به رنگ، کنتراست بالا |
| آیکون‌ها | SVG خطی درون‌سازی‌شده — بدون فونت‌آیکون، بدون درخواست خارجی |

| داشبورد (فارسی) | کاربران (فارسی) |
|---|---|
| ![Dashboard](docs/preview-dashboard.png) | ![Users](docs/preview-users.png) |

| کاربران (انگلیسی) | موبایل (دراور) |
|---|---|
| ![Users EN](docs/preview-users-en.png) | ![Mobile](docs/preview-mobile.png) |

## 📋 پیش‌نیازها

- یک اکانت Cloudflare (پلن رایگان کافی است)
- Node.js 18+ (فقط برای نصب با wrangler؛ روش paste نیازی به آن ندارد)

## 🚀 نصب — دو روش

### روش ۱: Paste در داشبورد (بدون ابزار)

1. فایل آمادهٔ `dist/gozargah-worker.js` را از [Releases](../../releases) بردارید (یا خودتان با `npm run build` بسازید).
2. در داشبورد Cloudflare: **Workers & Pages → Create → Worker** — نام دلخواه (مثلاً `gozargah`) و Create.
3. دکمهٔ **Edit code** → محتوای فایل را جایگزین کنید → **Deploy**.
4. **ساخت دیتابیس:** **Storage & Databases → D1 → Create** — نام: `gozargah`.
5. در Worker: **Settings → Bindings → Add → D1 Database** — Variable name: دقیقاً `GZ_DB` — دیتابیس `gozargah` → Deploy.
6. صفحهٔ `https://<worker>.workers.dev/gozargah` را باز کنید — تمام! (ورود با `admin`)

> تا قبل از اتصال D1، پنل «راهنمای اتصال دیتابیس» را نشان می‌دهد و Worker در حالت بی‌دیتابیس هم پروکسی می‌کند (UUID قطعی از روی هاست).

### روش ۲: wrangler (برای توسعه)

```bash
git clone https://github.com/panelgozargah/gozargah.git
cd gozargah
npm install
npx wrangler d1 create gozargah     # database_id را در wrangler.toml جای‌گذاری کنید
npm run deploy
```

به‌روزرسانی خودکار با GitHub Actions: در ریپو (فورک‌شده) دو Secret تعریف کنید — `CLOUDFLARE_API_TOKEN` و `CLOUDFLARE_ACCOUNT_ID` — هر push به main دیپلوی می‌شود.

## 🔑 ورود اولیه

| مورد | مقدار پیش‌فرض |
|------|----------------|
| آدرس پنل | `https://<worker>.workers.dev/gozargah` |
| رمز عبور | `admin` |

> ⚠️ پنل تا تغییر رمز پیش‌فرض، نوار هشدار زرد نشان می‌دهد. اولین کار: **تنظیمات → رمز جدید**.
> مسیر پنل و مسیر اشتراک هم از همان‌جا قابل تغییر است.

## 👥 کاربران و اشتراک

- هر کاربر: **UUID اختصاصی + رمز Trojan + سهمیه (GB) + تاریخ انقضا + فعال/غیرفعال**
- مصرف واقعی up/down هر کاربر زنده در کارت او نمایش داده می‌شود (نوار گرادیانی).
- برای هر کاربر: لینک‌های VLESS/Trojan + QR + سه لینک اشتراک (Base64 / Clash / Sing-box).
- تشخیص خودکار فرمت اشتراک بر اساس `User-Agent` کلاینت (+ override با `/clash`، `/singbox`، `/v2ray`).

| مسیر | توضیح |
|------|-------|
| `/{subPath}/{token}` | اشتراک خودکار (UA-sniff) |
| `/{subPath}/{token}/clash` | پروفایل Clash-Meta |
| `/{subPath}/{token}/singbox` | پروفایل Sing-box |
| `/{subPath}/{token}/v2ray` | Base64 لینک‌ها |
| `/gozargah` | پنل (قابل تغییر) |
| `/healthz` | سلامت Worker |

## ⚙️ متغیرهای قابل تنظیم در پنل

| تنظیم | پیش‌فرض | توضیح |
|-------|---------|-------|
| ProxyIPs | `proxyip.cmliussss.net` | برای اتصال به سایت‌های پشت کلادفلر؛ هر خط یک مورد. انتخاب IP برای هر کاربر پایدار است |
| مسیر اشتراک | `sub` | پیشوند لینک اشتراک |
| مسیر پنل | `gozargah` | مسیر مخفی پنل |
| رمز عبور | `admin` | حداقل ۸ کاراکتر |

## 📱 کلاینت‌های تست‌شده

v2rayNG · v2rayN · Streisand · Shadowrocket · Hiddify · Clash-Meta/Stash · Sing-box · Nekobox

## 🔐 نکات امنیتی

- رمز با PBKDF2-SHA256 و ۱۰۰٬۰۰۰ دور هش می‌شود؛ salt تصادفی ۱۶ بایتی.
- سشن: HMAC-SHA256 با انقضا — کوکی `HttpOnly; Secure; SameSite=Lax`.
- ورود: حداکثر ۵ تلاش در ۱۵ دقیقه (ماندگار در D1، بر اساس هش IP).
- UUID و رمز Trojan هر کاربر قابل چرخش یک‌کلیکه؛ تغییر رمز ادمین کل سشن‌ها را باطل می‌کند.
- پاسخ همهٔ مسیرهای ناشناخته یک صفحهٔ بی‌اثر است — وجود پنل قابل کشف از رفتار HTTP نیست.
- تمام دارایی‌های UI داخل خود Worker تعبیه شده؛ هیچ درخواست خارجی‌ای برای رندر پنل زده نمی‌شود.

## 🛣 نقشهٔ راه

- [ ] Shadowsocks AEAD
- [ ] فوروارد UDP-DNS (پورت ۵۳) و NAT64
- [ ] شروع شمارش سهمیه از اولین اتصال + ریست خودکار دوره‌ای
- [ ] ECH و fragment پریست‌های اپراتورهای ایران
- [ ] ربات تلگرام با FSM روی D1
- [ ] تست‌های خودکار (vitest + miniflare)

## 📄 لایسنس

MIT — آزاد برای استفاده، تغییر و توسعه. جزئیات در [LICENSE](LICENSE).
