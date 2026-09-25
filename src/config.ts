/**
 * Gozargah — global config, types and shared errors.
 */

export const VERSION = '1.2.0';
export const SCHEMA_VERSION = 2;

/** D1 binding name (see wrangler.toml) */
export const DB_BINDING = 'GZ_DB';

export interface Env {
  /** D1 database — optional at runtime; without it the worker runs in
   *  deterministic "no-database" mode and the panel shows a setup guide. */
  GZ_DB?: D1Database;
}

/** Error type carrying a short machine code for the panel API. */
export class GzError extends Error {
  code: string;
  constructor(message: string, code = 'gz_error') {
    super(message);
    this.name = 'GzError';
    this.code = code;
  }
}

/** Shared default values (used before the admin saves settings). */
export const DEFAULTS = {
  panelPath: 'gozargah',
  subPath: 'sub',
  /** community round-robin proxyIP endpoint — replace with your own for production */
  proxyIPs: ['proxyip.cmliussss.net'] as string[],
  defaultPassword: 'admin',
  pwIterations: 100_000,
  sessionTtlMs: 7 * 24 * 3600 * 1000,
  loginWindowMs: 15 * 60 * 1000,
  loginMaxAttempts: 5,
  /** settings/users cache TTL inside an isolate */
  cacheTtlMs: 10_000,
  /** flush accumulated per-user byte counters to D1 when above these */
  usageFlushBytes: 512 * 1024,
  usageFlushUsers: 8,
  usageFlushIntervalMs: 30_000,
  /** rolling quota-reset windows (ms) — user.resetAnchor + window */
  resetCycleMs: { daily: 86_400_000, weekly: 7 * 86_400_000, monthly: 30 * 86_400_000 },
} as const;

export type ResetCycle = 'none' | 'daily' | 'weekly' | 'monthly';

export function resetCycleMs(cycle: ResetCycle): number {
  if (cycle === 'daily') return DEFAULTS.resetCycleMs.daily;
  if (cycle === 'weekly') return DEFAULTS.resetCycleMs.weekly;
  if (cycle === 'monthly') return DEFAULTS.resetCycleMs.monthly;
  return 0;
}
