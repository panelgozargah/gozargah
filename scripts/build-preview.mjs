/**
 * Gozargah — offline panel preview renderer.
 * Bundles src/preview-entry.ts (mock data) and writes preview.html
 * so the panel UI can be opened in a browser without deploying.
 *
 * Usage: npm run preview
 */

import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

await build({
  entryPoints: ['src/preview-entry.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'scripts/.preview-build.mjs',
  logLevel: 'warning',
});

const mod = await import(pathToFileURL('scripts/.preview-build.mjs').href);
writeFileSync('preview.html', mod.html);
console.log('preview.html written:', mod.html.length, 'bytes');
