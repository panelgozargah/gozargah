/**
 * Gozargah — in-isolate diagnostic ring buffer (exposed via panel status API).
 */

const RING_CAP = 60;

export const logRing: string[] = [];

export function glog(msg: string): void {
  const line = new Date().toISOString() + ' ' + msg;
  logRing.push(line);
  if (logRing.length > RING_CAP) logRing.shift();
}
