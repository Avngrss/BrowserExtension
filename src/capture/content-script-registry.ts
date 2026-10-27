import type { ExtensionContextGuard } from '@/src/capture/extension-context-guard';

export type ContentScriptRegistryEntry = {
  buildVersion: string;
  runtimeId: string;
  contentInstanceId: string;
  guard: ExtensionContextGuard;
  dispose: () => void;
  disposed: boolean;
  /** Re-sync session + readiness after a bootstrap re-inject on the same document. */
  resyncFromBackground?: () => void;
};

const REGISTRY_KEY = '__bugCaptureAssistantContentV1';

function registryGlobal(): {
  [REGISTRY_KEY]?: ContentScriptRegistryEntry;
} {
  return globalThis as typeof globalThis & {
    [REGISTRY_KEY]?: ContentScriptRegistryEntry;
  };
}

export function readContentScriptRegistry():
  ContentScriptRegistryEntry | undefined {
  return registryGlobal()[REGISTRY_KEY];
}

export function registerContentScriptInstance(
  entry: ContentScriptRegistryEntry,
): void {
  const current = readContentScriptRegistry();
  if (current !== undefined && current !== entry && !current.disposed) {
    current.dispose();
  }
  registryGlobal()[REGISTRY_KEY] = entry;
}

export function markContentScriptRegistryDisposed(): void {
  const current = readContentScriptRegistry();
  if (current !== undefined) {
    current.disposed = true;
  }
}
