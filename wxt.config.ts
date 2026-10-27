import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type WxtViteConfig } from 'wxt';

const MAIN_CONSOLE_BRIDGE = {
  matches: ['http://*/*', 'https://*/*'],
  run_at: 'document_start' as const,
  world: 'MAIN' as const,
  js: ['content-scripts/console-bridge.js'],
};

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  hooks: {
    'prepare:tsconfig'(
      _wxt,
      { tsconfig }: { tsconfig: { compilerOptions?: { module?: string } } },
    ) {
      if (tsconfig.compilerOptions !== undefined) {
        tsconfig.compilerOptions.module = 'ESNext';
      }
    },
    'build:manifestGenerated'(_wxt, manifest) {
      const scripts = manifest.content_scripts ?? [];
      const withoutGeneratedMainBridge = scripts.filter((entry) => {
        const world = (entry as { world?: string }).world;
        return !(
          world === 'MAIN' &&
          entry.js?.includes('content-scripts/console-bridge.js')
        );
      });
      manifest.content_scripts = [
        MAIN_CONSOLE_BRIDGE,
        ...withoutGeneratedMainBridge,
      ];

      if (manifest.action !== undefined) {
        const action = manifest.action as Record<string, unknown>;
        delete action.default_popup;
        action.default_title = 'Bug Capture Assistant';
      }
    },
  },
  manifest: {
    name: 'Bug Capture Assistant',
    description:
      'Capture testing sessions and prepare structured evidence for bug reports.',
    version: '0.1.0',
    minimum_chrome_version: '114',
    permissions: ['storage', 'tabs', 'scripting', 'sidePanel', 'notifications'],
    host_permissions: ['http://*/*', 'https://*/*', '<all_urls>'],
    action: {
      default_title: 'Bug Capture Assistant',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
  vite: () =>
    ({
      plugins: [tailwindcss()],
    }) satisfies WxtViteConfig,
});
