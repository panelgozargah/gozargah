/**
 * Gozargah — preview entry: renders the panel with mock data (no worker).
 */

import { panelHtml } from './panel/ui';

export const html = panelHtml({
  panelPath: 'gozargah',
  dbOk: true,
  isDefaultPassword: true,
  lang: 'fa',
  mock: true,
});
