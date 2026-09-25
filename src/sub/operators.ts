/**
 * Gozargah — per-operator tuning knowledge base (v1.2).
 *
 * Pattern ported from the benchmark study (Nova-Proxy operator pools,
 * BPB smart-fragment caps): each Iranian ISP gets an honest, documented
 * preset — a uTLS fingerprint, an Xray TLS-fragment preset (within the
 * documented caps: packets=tlshello, length ≤ 500, interval ≤ 30ms) and
 * a TLS port wheel (Workers HTTPS ports, 443 first).
 *
 * Honesty gates (same as the production panel):
 *  - a preset is applied ONLY when the user explicitly asks (?op=…)
 *  - no ASN guessing, no silent branding — `auto` stays perfectly neutral
 *  - fragments ride the Xray JSON output only (the format that supports
 *    them natively); URI links carry the fingerprint
 */

export interface FragPreset {
  /** which packets to fragment — always tlshello (documented cap) */
  packets: 'tlshello';
  /** byte-length window, e.g. "100-200" (≤ 500) */
  length: string;
  /** delay window in ms, e.g. "10-20" (≤ 30) */
  interval: string;
}

export interface Operator {
  key: string;
  fa: string;
  en: string;
  /** uTLS fingerprint preset for this ISP's DPI behaviour */
  fp: string;
  /** Xray TLS-fragment preset (null = gentle network, no fragment) */
  frag: FragPreset | null;
  /** TLS port wheel — Workers HTTPS ports, 443 first */
  ports: number[];
  /** informational ASNs (documentation; never used for silent guessing) */
  asns: number[];
}

export const OPERATORS: Operator[] = [
  {
    key: 'mci', fa: 'همراه اول', en: 'MCI (Hamrah-e Aval)',
    fp: 'randomized',
    frag: { packets: 'tlshello', length: '100-200', interval: '10-20' },
    ports: [443, 2053, 2083, 2087, 8443],
    asns: [197207, 204650],
  },
  {
    key: 'irancell', fa: 'ایرانسل', en: 'Irancell',
    fp: 'chrome',
    frag: { packets: 'tlshello', length: '40-60', interval: '5-10' },
    ports: [443, 8443, 2053, 2087, 2083],
    asns: [44244, 61173],
  },
  {
    key: 'rightel', fa: 'رایتل', en: 'Rightel',
    fp: 'firefox',
    frag: { packets: 'tlshello', length: '60-120', interval: '10-25' },
    ports: [443, 2083, 2087, 8443, 2053],
    asns: [57218],
  },
  {
    key: 'shatel', fa: 'شاتل', en: 'Shatel',
    fp: 'chrome',
    frag: null,
    ports: [443, 2053, 2087, 2083, 8443],
    asns: [31549, 25164],
  },
  {
    key: 'tci', fa: 'مخابرات ایران', en: 'TCI',
    fp: 'safari',
    frag: { packets: 'tlshello', length: '80-150', interval: '10-20' },
    ports: [443, 2087, 8443, 2053, 2083],
    asns: [58224],
  },
];

export const DEFAULT_FP = 'chrome';

/** Workers HTTPS port wheel (informational alt-port list). */
export const TLS_PORTS = [443, 2053, 2083, 2087, 8443];

/** Resolve an explicit ?op= key; 'auto' / '' / unknown -> null (neutral). */
export function resolveOp(key?: string | null): Operator | null {
  if (!key) return null;
  const k = String(key).trim().toLowerCase();
  if (!k || k === 'auto') return null;
  return OPERATORS.find((o) => o.key === k) ?? null;
}

export function operatorLabel(op: Operator | null, lang: 'fa' | 'en' = 'fa'): string {
  if (!op) return lang === 'fa' ? 'خودکار' : 'Auto';
  return lang === 'fa' ? op.fa : op.en;
}

/** Subscription options carried through every format builder. */
export interface SubOpts {
  /** explicit operator key (from ?op=) — null/absent = neutral */
  opKey?: string;
  /** ECH is OPT-IN (?ech=1) — Iran's DPI rejects ECH handshakes, so the
   *  default is OFF everywhere (v1.2 lesson from the field). */
  ech?: boolean;
}

export function resolveOpts(opKey?: string | null, ech?: string | null): SubOpts {
  return { opKey: opKey ?? undefined, ech: ech === '1' || ech === 'true' };
}

/** uTLS fingerprint for the resolved operator. */
export function fpFor(opts: SubOpts | null | undefined): string {
  if (opts?.opKey) {
    const op = resolveOp(opts.opKey);
    if (op) return op.fp;
  }
  return DEFAULT_FP;
}

/** True when an operator preset is explicitly active (allows honest branding). */
export function opBranding(opts: SubOpts | null | undefined): Operator | null {
  return opts?.opKey ? resolveOp(opts.opKey) : null;
}
