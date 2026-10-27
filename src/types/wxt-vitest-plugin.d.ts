declare module 'wxt/testing/vitest-plugin' {
  import type { InlineConfig } from 'wxt';
  import type { PluginOption } from 'vite';

  export function WxtVitest(
    inlineConfig?: InlineConfig,
  ): Promise<PluginOption[]>;
}
