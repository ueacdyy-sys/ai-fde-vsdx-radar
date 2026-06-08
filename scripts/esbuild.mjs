import * as fs from 'node:fs/promises';
import esbuild from 'esbuild';

const production = process.argv.includes('--production');

await fs.rm('dist-bundle', { recursive: true, force: true });

await esbuild.build({
  entryPoints: ['src/extension.ts'],
  outfile: 'dist-bundle/extension.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  sourcemap: !production,
  sourcesContent: false,
  minify: production,
  legalComments: 'none',
  logLevel: 'info'
});
