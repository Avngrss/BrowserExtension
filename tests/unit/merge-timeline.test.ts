import { describe, expect, it } from 'vitest';
import { mergeTimelineEntries } from '@/src/domain/timeline-entry';

describe('mergeTimelineEntries', () => {
  it('orders actions and console issues chronologically', () => {
    const entries = mergeTimelineEntries(
      [
        {
          id: 'action-2',
          type: 'click',
          sessionId: 'session-1',
          timestamp: 3_000,
          url: 'https://example.com/',
          element: { tagName: 'button', semanticType: 'button' },
        },
      ],
      [
        {
          id: 'issue-1',
          sessionId: 'session-1',
          timestamp: 2_000,
          lastSeenAt: 2_000,
          category: 'console-error',
          message: 'Failed',
          url: 'https://example.com/',
          occurrenceCount: 1,
          disposition: 'unexpected',
        },
      ],
    );

    expect(entries.map((entry) => entry.kind)).toEqual([
      'console-issue',
      'action',
    ]);
  });
});
