/**
 * Gozargah — outbound TCP dialer with ProxyIP fallback chain.
 *
 * edgetunnel-style: try the target directly first; Cloudflare refuses
 * loopback connections to CF-fronted targets, so on failure we re-dial
 * through the configured proxyIP list (per-user stable start index,
 * nahan-style consistent hashing).
 */

import { connect } from 'cloudflare:sockets';
import { GzError } from '../config';
import { withTimeout } from '../utils/crypto';
import { glog } from '../utils/log';

const DIAL_TIMEOUT_MS = 6000;

export interface DialResult {
  socket: Socket;
  via: string;
}

export async function dialWithFallback(
  host: string,
  port: number,
  proxyIPs: string[],
  startIdx = 0,
): Promise<DialResult> {
  const candidates: string[] = [host + ':' + port];
  for (let k = 0; k < proxyIPs.length; k++) {
    const ip = proxyIPs[(startIdx + k) % proxyIPs.length];
    if (ip) candidates.push(ip + ':' + port);
  }

  let lastErr: unknown = null;
  for (const cand of candidates) {
    let sock: Socket | null = null;
    try {
      sock = connect(cand);
      await withTimeout(sock.opened, DIAL_TIMEOUT_MS, 'dial ' + cand);
      glog('dial ok -> ' + cand);
      return { socket: sock, via: cand };
    } catch (e) {
      lastErr = e;
      try { sock?.close(); } catch { /* ignore */ }
    }
  }
  throw new GzError('all dial attempts failed: ' + String(lastErr), 'dial_failed');
}
