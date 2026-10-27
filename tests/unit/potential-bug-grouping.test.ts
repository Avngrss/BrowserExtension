import { describe, expect, it } from 'vitest';
import type { PotentialBug } from '@/src/domain/potential-bug';
import {
  applyDetectedIssue,
  createManualBug,
  selectMeaningfulActions,
} from '@/src/potential-bugs/potential-bug-grouping';
import {
  CART_PAGE,
  CHECKOUT_PAGE,
  SESSION_ID,
  clickAction,
  navigationAction,
  sequentialIds,
} from '../helpers/potential-bug-fixtures';

function detect(
  bugs: PotentialBug[],
  createId: () => string,
  input: {
    category: 'ui' | 'console' | 'network';
    issueId: string;
    detectedAt: number;
    page?: typeof CHECKOUT_PAGE;
  },
) {
  return applyDetectedIssue(
    bugs,
    {
      sessionId: SESSION_ID,
      issue: { category: input.category, issueId: input.issueId },
      detectedAt: input.detectedAt,
      page: input.page ?? CHECKOUT_PAGE,
      actions: [],
    },
    createId,
  );
}

describe('applyDetectedIssue', () => {
  it('creates a potential bug for the first unique issue', () => {
    const result = detect([], sequentialIds(), {
      category: 'ui',
      issueId: 'u1',
      detectedAt: 1_000,
    });

    expect(result.created).toBe(true);
    expect(result.bugs).toHaveLength(1);
    expect(result.bug).toMatchObject({
      id: 'bug-1',
      sessionId: SESSION_ID,
      source: 'automatic',
      status: 'included',
      page: CHECKOUT_PAGE,
      issues: [{ category: 'ui', issueId: 'u1' }],
    });
  });

  it('groups UI, Console, and Network issues on one page within 3 seconds', () => {
    const createId = sequentialIds();
    let bugs = detect([], createId, {
      category: 'ui',
      issueId: 'u1',
      detectedAt: 1_000,
    }).bugs;
    const consoleResult = detect(bugs, createId, {
      category: 'console',
      issueId: 'c1',
      detectedAt: 2_500,
    });
    bugs = consoleResult.bugs;
    const networkResult = detect(bugs, createId, {
      category: 'network',
      issueId: 'n1',
      detectedAt: 4_000,
    });

    expect(consoleResult.created).toBe(false);
    expect(networkResult.created).toBe(false);
    expect(networkResult.bugs).toHaveLength(1);
    expect(networkResult.bugs[0]?.issues).toEqual([
      { category: 'ui', issueId: 'u1' },
      { category: 'console', issueId: 'c1' },
      { category: 'network', issueId: 'n1' },
    ]);
  });

  it('creates a separate bug outside the grouping window', () => {
    const createId = sequentialIds();
    const first = detect([], createId, {
      category: 'ui',
      issueId: 'u1',
      detectedAt: 1_000,
    });
    const second = detect(first.bugs, createId, {
      category: 'console',
      issueId: 'c1',
      detectedAt: 4_001,
    });

    expect(second.created).toBe(true);
    expect(second.bugs.map((bug) => bug.id)).toEqual(['bug-1', 'bug-2']);
    expect(second.bugs[1]?.issues).toEqual([
      { category: 'console', issueId: 'c1' },
    ]);
  });

  it('creates a separate bug for an issue on another page', () => {
    const createId = sequentialIds();
    const first = detect([], createId, {
      category: 'ui',
      issueId: 'u1',
      detectedAt: 1_000,
    });
    const second = detect(first.bugs, createId, {
      category: 'ui',
      issueId: 'u2',
      detectedAt: 1_500,
      page: CART_PAGE,
    });

    expect(second.created).toBe(true);
    expect(second.bugs).toHaveLength(2);
  });

  it('ignores an issue that already belongs to a bug', () => {
    const createId = sequentialIds();
    const first = detect([], createId, {
      category: 'ui',
      issueId: 'u1',
      detectedAt: 1_000,
    });
    const duplicate = detect(first.bugs, createId, {
      category: 'ui',
      issueId: 'u1',
      detectedAt: 9_000,
    });

    expect(duplicate.bug).toBeNull();
    expect(duplicate.created).toBe(false);
    expect(duplicate.bugs).toBe(first.bugs);
  });
});

describe('selectMeaningfulActions', () => {
  it('keeps the last 5 report-worthy actions before detection', () => {
    const actions = [
      clickAction('a1', 1, 'Home'),
      clickAction('a2', 2, 'Products'),
      clickAction('a3', 3),
      clickAction('a4', 4, 'Cart'),
      navigationAction('a5', 5, '/cart'),
      clickAction('a6', 6, undefined, 'a'),
      clickAction('a7', 7, 'Checkout'),
      clickAction('a8', 8, 'Pay'),
      clickAction('a9', 9, 'Confirm'),
      clickAction('late', 50, 'After detection'),
    ];

    const selected = selectMeaningfulActions(actions, SESSION_ID, 10);

    expect(selected).toEqual([
      { actionId: 'a2', step: 'Clicked “Products”.' },
      { actionId: 'a5', step: 'Opened the cart page.' },
      { actionId: 'a7', step: 'Clicked “Checkout”.' },
      { actionId: 'a8', step: 'Clicked “Pay”.' },
      { actionId: 'a9', step: 'Clicked “Confirm”.' },
    ]);
  });

  it('does not mutate stored actions', () => {
    const actions = [clickAction('a2', 2, 'B'), clickAction('a1', 1, 'A')];
    const snapshot = structuredClone(actions);
    selectMeaningfulActions(actions, SESSION_ID, 10);
    expect(actions).toEqual(snapshot);
  });
});

describe('createManualBug', () => {
  it('creates a separate manual bug for every capture with optional note', () => {
    const createId = sequentialIds();
    const first = createManualBug(
      [],
      {
        sessionId: SESSION_ID,
        capturedAt: 5_000,
        page: CHECKOUT_PAGE,
        actions: [clickAction('a1', 1, 'Pay')],
        nearbyIssues: [{ category: 'console', issueId: 'c1' }],
        note: 'Total is wrong',
      },
      createId,
    );
    const second = createManualBug(
      first.bugs,
      {
        sessionId: SESSION_ID,
        capturedAt: 6_000,
        page: CHECKOUT_PAGE,
        actions: [],
        nearbyIssues: [{ category: 'console', issueId: 'c1' }],
      },
      createId,
    );

    expect(second.bugs).toHaveLength(2);
    expect(first.bug).toMatchObject({
      source: 'manual',
      note: 'Total is wrong',
      issues: [{ category: 'console', issueId: 'c1' }],
      actions: [{ actionId: 'a1', step: 'Clicked “Pay”.' }],
    });
    expect(second.bug.note).toBeUndefined();
    expect(second.bug.issues).toEqual([]);
  });
});
