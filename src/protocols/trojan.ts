/**
 * Gozargah — Trojan over WebSocket protocol parser.
 * Wire: [sha224(pw) hex 56][\r\n][cmd 1][port 2][atyp 1][addr][\r\n][payload]
 */

import { GzError } from '../config';
import { parseAddress, ParsedTarget } from './common';

export interface TrojanRequest extends ParsedTarget {
  isUDP: boolean;
}

export function parseTrojan(chunk: Uint8Array): TrojanRequest {
  if (chunk.length < 62) throw new GzError('short trojan header', 'bad_request');
  const hash = new TextDecoder().decode(chunk.slice(0, 56));
  if (!/^[0-9a-f]{56}$/.test(hash)) throw new GzError('bad trojan hash', 'bad_request');
  if (chunk[56] !== 0x0d || chunk[57] !== 0x0a) throw new GzError('bad trojan crlf', 'bad_request');

  const cmd = chunk[58];
  if (cmd !== 0x01 && cmd !== 0x03) throw new GzError('unsupported trojan command ' + cmd, 'bad_request');

  const port = (chunk[59] << 8) | chunk[60];
  const addr = parseAddress(chunk, 61);
  const i = addr.next;
  if (chunk.length < i + 2 || chunk[i] !== 0x0d || chunk[i + 1] !== 0x0a) {
    throw new GzError('bad trojan crlf2', 'bad_request');
  }
  return { host: addr.host, port, headerLen: i + 2, isUDP: cmd === 0x03 };
}
