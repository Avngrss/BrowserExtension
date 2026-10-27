import { describe, expect, it } from 'vitest';
import {
  createContentBootstrapPing,
  isCompatibleBootstrapPong,
} from '@/src/messaging/content-bootstrap-types';

describe('content bootstrap handshake', () => {
  it('accepts matching pong', () => {
    const ping = createContentBootstrapPing({
      buildVersion: '0.1.0',
      runtimeId: 'abc',
    });
    const pong = {
      type: 'CONTENT_BOOTSTRAP_PONG' as const,
      protocolVersion: 1 as const,
      buildVersion: ping.buildVersion,
      runtimeId: ping.runtimeId,
      contentInstanceId: 'instance-1',
      documentId: 'doc-1',
    };
    expect(
      isCompatibleBootstrapPong(pong, {
        buildVersion: ping.buildVersion,
        runtimeId: ping.runtimeId,
      }),
    ).toBe(true);
  });
});
