import type { CollectorReadinessFlags } from '@/src/messaging/capture-readiness-types';

export type ReadinessCapableCollector = {
  getCollectorReadiness(): CollectorReadinessFlags;
  resetForSessionChange(sessionId: string): void;
};

export function mergeCollectorReadiness(
  parts: CollectorReadinessFlags[],
): CollectorReadinessFlags {
  return parts.reduce<CollectorReadinessFlags>(
    (accumulator, part) => ({
      actions: accumulator.actions && part.actions,
      ui: accumulator.ui && part.ui,
      console: accumulator.console && part.console,
      network: accumulator.network && part.network,
    }),
    {
      actions: true,
      ui: true,
      console: true,
      network: true,
    },
  );
}
