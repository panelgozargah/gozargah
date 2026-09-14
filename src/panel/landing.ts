/**
 * Gozargah — stealth landing page.
 * Any unknown GET shows this innocuous page: zero information leak
 * (nahan-style), just the brand poem about passages.
 */

import { emblemSvg } from './page';
import { LOGO_FAV_B64 } from '../assets/logo';
import { PANEL_CSS } from './styles';
import { VERSION } from '../config';

export function landingHtml(lang: string): string {
  const fa = lang !== 'en';
  const title = fa ? 'گذرگاه' : 'Gozargah';
  const line1 = fa
    ? 'هر مسیری، از یک گذرگاه می‌گذرد.'
    : 'Every road passes through a gateway.';
  const line2 = fa
    ? 'سدی، پیش از آبِ روان نایستد.'
    : 'A dam cannot hold flowing water forever.';
  return (
    '<!DOCTYPE html><html lang="' + (fa ? 'fa' : 'en') + '" dir="' + (fa ? 'rtl' : 'ltr') + '"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex, nofollow">' +
    '<title>' + title + '</title>' +
    '<link rel="icon" href="' + LOGO_FAV_B64 + '">' +
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css">' +
    '<style>' + PANEL_CSS +
    '.land{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;gap:6px}' +
    '.land .emblem{width:130px;margin-bottom:10px}' +
    '.land h1{font-size:34px;font-weight:800}' +
    '.land p{color:var(--mut);font-size:15px;max-width:420px}' +
    '.land .p2{font-size:13px;color:var(--mut2);font-style:italic}' +
    '.land footer{position:absolute;bottom:18px;font-size:11px;color:var(--mut2)}' +
    '</style></head><body>' +
    '<div class="gz-bg"></div>' +
    '<div class="land">' +
    emblemSvg('', 'land') +
    '<h1 class="gradtext">' + title + '</h1>' +
    '<p>' + line1 + '</p>' +
    '<p class="p2">«' + line2 + '»</p>' +
    '<footer>Gozargah · v' + VERSION + '</footer>' +
    '</div></body></html>'
  );
}
