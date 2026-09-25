/**
 * Render the v1.2 user status page with mock data → statuspage.html
 * (offline preview for screenshots / QA).
 */
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';

await build({
  entryPoints: ['src/test/userpage-mock.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: 'scripts/.userpage-build.mjs',
  logLevel: 'warning',
  external: ['qrcode'],
});

const mod = await import('./.userpage-build.mjs?url').catch(async () => {
  // fallback: direct import of the built file
  const { pathToFileURL } = await import('node:url');
  return import(pathToFileURL('scripts/.userpage-build.mjs').href);
});
writeFileSync('statuspage.html', mod.html);
console.log('statuspage.html written:', mod.html.length, 'bytes');
