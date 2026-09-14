/**
 * Gozargah — panel UI composer (complete HTML document).
 */

import { PANEL_CSS } from './styles';
import { panelBody, emblemSvg } from './page';
import { LOGO_BRAND_B64, LOGO_FAV_B64 } from '../assets/logo';
import { VERSION } from '../config';

export interface PanelData {
  panelPath: string;
  dbOk: boolean;
  isDefaultPassword: boolean;
  version?: string;
  lang?: string;
  mock?: boolean;
}

export function panelHtml(d: PanelData): string {
  const version = d.version ?? VERSION;
  const body = panelBody({
    panelPath: d.panelPath,
    dbOk: d.dbOk,
    isDefaultPassword: d.isDefaultPassword,
    version,
    lang: d.lang ?? 'fa',
    mock: d.mock,
    logo: LOGO_BRAND_B64,
    favicon: LOGO_FAV_B64,
  });
  return (
    '<!DOCTYPE html><html lang="fa" dir="rtl"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<meta name="robots" content="noindex, nofollow">' +
    '<title>Gozargah · گذرگاه</title>' +
    '<link rel="icon" href="' + LOGO_FAV_B64 + '">' +
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css">' +
    '<style>' + PANEL_CSS + '</style>' +
    '</head><body>' + body + '</body></html>'
  );
}

export { emblemSvg };
