/**
 * Gozargah — VLESS over WebSocket protocol parser.
 * Wire: [ver 1][uuid 16][optLen 1][opt N][cmd 1][port 2][atyp 1][addr][payload]
 * UUID validation is the caller's job (user lookup in D1 / derived uuid).
 */

import { GzError } from '../config';
import { parseAddress } from './common';

export interface VlessRequest {
  version: number;
  uuid: string;
  isUDP: boolean;
  host: string;
  port: number;
  headerLen: number;
}

export function parseVless(chunk: Uint8Array): VlessRequest {
  if (chunk.length < 24) throw new GzError('short vless header', 'bad_request');
  const version = chunk[0];
  if (version !== 0) throw new GzError('unsupported vless version ' + version, 'bad_request');

  const uuid = formatUuid(chunk.slice(1, 17));

  const optLen = chunk[17];
  let i = 18 + optLen;
  if (chunk.length < i + 4) throw new GzError('short vless header', 'bad_request');

  const cmd = chunk[i];
  i += 1;
  if (cmd !== 0x01 && cmd !== 0x02) throw new GzError('unsupported vless command ' + cmd, 'bad_request');

  const port = (chunk[i] << 8) | chunk[i + 1];
  i += 2;

  const addr = parseAddress(chunk, i);
  return { version, uuid, isUDP: cmd === 0x02, host: addr.host, port, headerLen: addr.next };
}

/** [ver, 0x00] success response. */
export function vlessOkResponse(version: number): Uint8Array {
  return new Uint8Array([version, 0x00]);
}

function formatUuid(b: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < b.length; i++) hex += b[i].toString(16).padStart(2, '0');
  return (
    hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) +
    '-' + hex.slice(16, 20) + '-' + hex.slice(20, 32)
  );
}
