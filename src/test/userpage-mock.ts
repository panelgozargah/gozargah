/**
 * Mock entry: renders the v1.2 user status page (no worker needed).
 */
import { userPageHtml } from '../panel/userpage';

const user = {
  id: 2,
  name: 'سارا',
  uuid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  trojanPass: 'gz-trojan-demo-pass',
  quotaBytes: 50 * 1024 ** 3,
  usedUp: 4.1 * 1024 ** 3,
  usedDown: 31.6 * 1024 ** 3,
  expiryAt: Date.now() + 21 * 86_400_000,
  expiryDays: 0,
  firstUsedAt: Date.now() - 9 * 86_400_000,
  resetAnchor: 0,
  enabled: true,
  isAdmin: false,
  createdAt: Date.now() - 40 * 86_400_000,
  lastSeen: Date.now() - 7 * 60_000,
};

export const html = await userPageHtml({
  host: 'gozargah.example.workers.dev',
  user,
  token: 'demo-token-1234567890',
  subPath: 'sub',
  panelPath: 'gozargah',
  lang: 'fa',
  opts: { opKey: 'mci' },
  echOn: false,
});
