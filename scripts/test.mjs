/**
 * Gozargah — test runner: bundles src/test/engine.ts with esbuild (so TS +
 * ESM deps resolve) and executes it under Node. Zero extra devDeps needed.
 *
 * Usage: npm test
 */

import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outfile = join(here, '.test-build.mjs');

await build({
  entryPoints: [join(here, '..', 'src', 'test', 'engine.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'warning',
  // qrcode uses node builtins (fs for the png renderer) — keep it external;
  // node resolves it from node_modules at runtime (bundle lives in the repo).
  external: ['qrcode'],
});

const res = spawnSync(process.execPath, [outfile], { stdio: 'inherit' });
try { rmSync(outfile, { force: true }); } catch { /* ignore */ }
process.exit(res.status ?? 1);
