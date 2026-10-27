import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const outDir = path.join(rootDir, 'public', 'content-scripts');
const outFile = path.join(outDir, 'console-bridge.js');

await mkdir(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(rootDir, 'src', 'console-bridge', 'main.ts')],
  outfile: outFile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome114',
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.MODE': '"production"',
    'import.meta.env.PROD': 'true',
  },
  plugins: [
    {
      name: 'alias-at-src',
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => {
          const basePath = path.join(rootDir, args.path.slice(2));
          for (const candidate of [
            basePath,
            `${basePath}.ts`,
            `${basePath}.tsx`,
          ]) {
            if (existsSync(candidate)) {
              return { path: candidate };
            }
          }
          return { path: `${basePath}.ts` };
        });
      },
    },
  ],
});
