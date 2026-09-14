/**
 * Gozargah — shared protocol helpers (address parsing for VLESS/Trojan).
 */

import { GzError } from '../config';
import { utf8Decode } from '../utils/crypto';

export interface ParsedTarget {
  host: string;
  port: number;
  headerLen: number;
}

/** Reads [atyp][addr] starting at `i`; returns host + next offset. */
export function parseAddress(chunk: Uint8Array, i: number): { host: string; next: number } {
  const atyp = chunk[i];
  i += 1;
  if (atyp === 1) {
    if (chunk.length < i + 4) throw new GzError('short ipv4 address', 'bad_request');
    const host = chunk.slice(i, i + 4).join('.');
    return { host, next: i + 4 };
  }
  if (atyp === 2) {
    const len = chunk[i];
    i += 1;
    if (chunk.length < i + len) throw new GzError('short domain', 'bad_request');
    return { host: utf8Decode(chunk.slice(i, i + len)), next: i + len };
  }
  if (atyp === 3) {
    if (chunk.length < i + 16) throw new GzError('short ipv6 address', 'bad_request');
    const parts: string[] = [];
    for (let k = 0; k < 8; k++) {
      parts.push(((chunk[i + 2 * k] << 8) | chunk[i + 2 * k + 1]).toString(16));
    }
    return { host: parts.join(':'), next: i + 16 };
  }
  throw new GzError('unsupported address type ' + atyp, 'bad_request');
}
