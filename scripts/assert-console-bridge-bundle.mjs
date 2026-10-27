/* eslint-env node */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const bridgePath = path.join(
  rootDir,
  '.output',
  'chrome-mv3',
  'content-scripts',
  'console-bridge.js',
);
const manifestPath = path.join(
  rootDir,
  '.output',
  'chrome-mv3',
  'manifest.json',
);

const forbiddenPatterns = [
  { label: 'eval(', pattern: /\beval\s*\(/ },
  { label: 'new Function', pattern: /\bnew\s+Function\b/ },
  {
    label: 'inline script text assignment',
    pattern: /\.textContent\s*=\s*[`'"]/,
  },
  {
    label: 'dynamic script injection',
    pattern: /createElement\s*\(\s*[`'"]script[`'"]\s*\)/,
  },
  {
    label: 'WXT MAIN-world bootstrap metadata',
    pattern: /world\s*:\s*[`'"]MAIN[`'"]/,
  },
];

const bridgeSource = await readFile(bridgePath, 'utf8');
for (const { label, pattern } of forbiddenPatterns) {
  if (pattern.test(bridgeSource)) {
    throw new Error(
      `Console bridge production bundle contains forbidden pattern: ${label}`,
    );
  }
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const contentScripts = manifest.content_scripts ?? [];
const mainBridge = contentScripts.find(
  (entry) =>
    entry.world === 'MAIN' &&
    Array.isArray(entry.js) &&
    entry.js.includes('content-scripts/console-bridge.js'),
);

if (mainBridge === undefined) {
  throw new Error(
    'Manifest is missing MAIN-world console bridge registration.',
  );
}

if (!mainBridge.matches?.includes('http://*/*')) {
  throw new Error('Console bridge is missing http://*/* match.');
}
if (!mainBridge.matches?.includes('https://*/*')) {
  throw new Error('Console bridge is missing https://*/* match.');
}
if (mainBridge.run_at !== 'document_start') {
  throw new Error('Console bridge must run at document_start.');
}

console.info('Console bridge production bundle and manifest checks passed.');
