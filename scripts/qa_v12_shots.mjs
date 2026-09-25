/**
 * QA screenshots for the v1.2 public repo upgrade:
 *  - panel preview (dashboard, users tab)
 *  - user status page (dark + light, desktop + mobile)
 *  - repo live page
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'qa_v12';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
});

async function shot(htmlPath, path, { w = 1440, h = 900, full = false, theme = '', mobile = false } = {}) {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: w, height: h },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto('file://' + htmlPath);
  await page.waitForTimeout(700);
  if (theme) {
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; localStorage.setItem('gzup_theme', t); }, theme);
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path, fullPage: full });
  await ctx.close();
  console.log('shot:', path);
}

// panel preview (mock data)
await shot('/home/z/my-project/gozargah/preview.html', OUT + '/panel_dash.png', { full: true });

// user status page variants
await shot('/home/z/my-project/gozargah/statuspage.html', OUT + '/status_dark.png', { full: true });
await shot('/home/z/my-project/gozargah/statuspage.html', OUT + '/status_light.png', { full: true, theme: 'light' });
await shot('/home/z/my-project/gozargah/statuspage.html', OUT + '/status_mobile.png', { full: true, mobile: true });

await browser.close();
console.log('done');
