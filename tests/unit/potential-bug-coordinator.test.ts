import { describe, expect, it, vi } from 'vitest';
import type { CapturedAction } from '@/src/domain/action';
import type { SessionSnapshot } from '@/src/domain/session';
import { DEFAULT_TEST_SESSION_TARGET } from '@/src/domain/session-target';
import { createPotentialBugCoordinator } from '@/src/potential-bugs/potential-bug-coordinator';
import { PotentialBugStore } from '@/src/potential-bugs/potential-bug-store';
import {
  SESSION_ID,
  clickAction,
  consoleIssue,
  sequentialIds,
} from '../helpers/potential-bug-fixtures';

function setup(status: 'recording' | 'paused' | 'stopped' = 'recording') {
  let now = 10_000;
  const session: SessionSnapshot = {
    status,
    id: SESSION_ID,
    startedAt: 1,
    pausedAt: status === 'paused' ? 2 : null,
    stoppedAt: status === 'stopped' ? 3 : null,
    ...DEFAULT_TEST_SESSION_TARGET,
  } as SessionSnapshot;
  let stored: unknown;
  const store = new PotentialBugStore(
    {
      read: () => Promise.resolve(stored),
      write: (bugs) => {
        stored = bugs;
        return Promise.resolve();
      },
      remove: () => {
        stored = undefined;
        return Promise.resolve();
      },
    },
    sequentialIds(),
  );
  const actions: CapturedAction[] = [clickAction('a1', 9_000, 'Pay')];
  const issues = {
    uiIssues: [],
    consoleIssues: [consoleIssue('c1', { lastSeenAt: 9_500 })],
    networkIssues: [],
  };
  const onBugCreated = vi.fn();
  const onBugsChanged = vi.fn();
  const requestManualScreenshot = vi.fn();
  const coordinator = createPotentialBugCoordinator({
    store,
    getSessionState: () => session,
    sanitizePageUrl: (url) => url,
    getActions: () => actions,
    getIssues: () => issues,
    now: () => now,
    onBugCreated,
    onBugsChanged,
    requestManualScreenshot,
  });
  return {
    store,
    coordinator,
    onBugCreated,
    onBugsChanged,
    requestManualScreenshot,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('potential bug coordinator', () => {
  it('notifies once per created bug, not for grouped issues', async () => {
    const ctx = setup();
    await ctx.coordinator.handleNewUniqueIssue({
      issueCategory: 'ui',
      issueId: 'u1',
    });
    ctx.advance(1_000);
    await ctx.coordinator.handleNewUniqueIssue({
      issueCategory: 'console',
      issueId: 'c1',
    });
    ctx.advance(5_000);
    await ctx.coordinator.handleNewUniqueIssue({
      issueCategory: 'network',
      issueId: 'n1',
    });

    expect(ctx.store.getBugs()).toHaveLength(2);
    expect(ctx.onBugCreated).toHaveBeenCalledTimes(2);
    expect(ctx.onBugCreated).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ issueCategory: 'ui' }),
    );
    expect(ctx.onBugCreated).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ issueCategory: 'network' }),
    );
    expect(ctx.onBugsChanged).toHaveBeenCalledTimes(3);
  });

  it('attaches the last meaningful actions and page context', async () => {
    const ctx = setup();
    await ctx.coordinator.handleNewUniqueIssue({
      issueCategory: 'ui',
      issueId: 'u1',
    });
    expect(ctx.store.getBugs()[0]).toMatchObject({
      actions: [{ actionId: 'a1', step: 'Clicked “Pay”.' }],
      page: { pathname: expect.any(String) as string },
    });
  });

  it('ignores mark screenshot events and sessions that are not recording', async () => {
    const ctx = setup('stopped');
    await ctx.coordinator.handleNewUniqueIssue({
      issueCategory: 'mark',
      issueId: 'x',
    });
    await ctx.coordinator.handleNewUniqueIssue({
      issueCategory: 'ui',
      issueId: 'u1',
    });
    expect(ctx.store.getBugs()).toEqual([]);
    expect(ctx.onBugCreated).not.toHaveBeenCalled();
  });

  it('captures multiple manual bugs with screenshots and nearby issues', async () => {
    const ctx = setup('paused');
    const first = await ctx.coordinator.captureManual({ note: 'Wrong total' });
    const second = await ctx.coordinator.captureManual({});

    expect(first.ok && second.ok).toBe(true);
    const bugs = ctx.store.getBugs();
    expect(bugs).toHaveLength(2);
    expect(bugs[0]).toMatchObject({
      source: 'manual',
      note: 'Wrong total',
      issues: [{ category: 'console', issueId: 'c1' }],
    });
    expect(bugs[1]?.issues).toEqual([]);
    expect(ctx.requestManualScreenshot.mock.calls).toEqual([
      ['bug-1'],
      ['bug-2'],
    ]);
    expect(ctx.onBugCreated).not.toHaveBeenCalled();
  });

  it('rejects manual capture without an active capture', async () => {
    const ctx = setup('stopped');
    const result = await ctx.coordinator.captureManual({});
    expect(result).toMatchObject({ ok: false, code: 'NO_ACTIVE_SESSION' });
  });
});
