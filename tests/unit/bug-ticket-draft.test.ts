import { describe, expect, it } from 'vitest';
import {
  buildBugTicketDraft,
  formatBugTicketDraft,
} from '@/src/bug-report/bug-ticket-draft';
import {
  consoleIssue,
  networkIssue,
  potentialBug,
  uiIssue,
} from '../helpers/potential-bug-fixtures';

describe('buildBugTicketDraft', () => {
  it('writes a UI ticket from the visible message', () => {
    const draft = buildBugTicketDraft(
      potentialBug('bug-1', {
        page: {
          url: 'https://shop.test/checkout',
          pathname: '/checkout',
          title: 'Checkout',
        },
        actions: [
          { actionId: 'a1', step: 'Opened /checkout.' },
          { actionId: 'a2', step: 'Clicked “Pay”.' },
        ],
        issues: [{ category: 'ui', issueId: 'u1' }],
      }),
      {
        uiIssues: [uiIssue('u1')],
        consoleIssues: [],
        networkIssues: [],
      },
    );

    expect(draft.title).toBe('[Checkout] Payment unavailable');
    expect(draft.description).toContain('On Checkout');
    expect(draft.description).toContain('Clicked “Pay”.');
    expect(draft.actualResult).toBe('The page shows “Payment unavailable”.');
    expect(draft.expectedResult).toBe('This message should not appear.');
    expect(draft.severity).toBe('Major');
    expect(draft.priority).toBe('High');
    expect(draft.labels).toEqual(['ui', 'checkout']);
    expect(draft.environment).toBe('https://shop.test/checkout');
    expect(formatBugTicketDraft(draft)).toContain('## Steps to Reproduce');
  });

  it('keeps a console ticket developer-facing', () => {
    const draft = buildBugTicketDraft(
      potentialBug('bug-2', {
        issues: [{ category: 'console', issueId: 'c1' }],
      }),
      {
        uiIssues: [],
        consoleIssues: [consoleIssue('c1')],
        networkIssues: [],
      },
    );

    expect(draft.title).toBe('[Checkout] Boom');
    expect(draft.description).toContain('DevTools Console');
    expect(draft.severity).toBe('Minor');
    expect(draft.priority).toBe('Low');
    expect(draft.labels).toEqual(['console', 'checkout']);
  });

  it('uses UI as the title when console and network are related', () => {
    const draft = buildBugTicketDraft(
      potentialBug('bug-3', {
        issues: [
          { category: 'ui', issueId: 'u1' },
          { category: 'console', issueId: 'c1' },
          { category: 'network', issueId: 'n1' },
        ],
      }),
      {
        uiIssues: [uiIssue('u1')],
        consoleIssues: [consoleIssue('c1')],
        networkIssues: [networkIssue('n1', { status: 500 })],
      },
    );

    expect(draft.title).toBe('[Checkout] Payment unavailable');
    expect(draft.description).toContain('Also captured:');
    expect(draft.description).toContain('Boom');
    expect(draft.actualResult).toBe('The page shows “Payment unavailable”.');
    expect(draft.labels).toEqual(['ui', 'console', 'api', 'checkout']);
  });

  it('omits analytics HTTP 200 and does not invent a failure', () => {
    const draft = buildBugTicketDraft(
      potentialBug('bug-4', {
        source: 'manual',
        note: 'No confirmation after submit. Expected: a success message.',
        issues: [
          {
            category: 'network',
            issueId: 'n1',
          },
        ],
      }),
      {
        uiIssues: [],
        consoleIssues: [],
        networkIssues: [
          networkIssue('n1', {
            url: 'https://shop.test/g/collect',
            status: 200,
          }),
        ],
      },
    );

    expect(draft.title).toContain('No confirmation after submit');
    expect(draft.actualResult).toBe(
      'No confirmation after submit. Expected: a success message.',
    );
    expect(draft.expectedResult).toBe('a success message.');
    expect(draft.description).not.toContain('/g/collect');
    expect(draft.severity).toBe('Minor');
  });

  it('keeps ticket URLs short when a collect request and opaque page id are captured', () => {
    const productId = '01M69B1HW8E19B80PAP2YK9WF0';
    const collectQuery =
      'v=2&tid=G-0BJFXRKTYC&gtm=45je6as1v9184871799za200zd9184871799xf1&_p=1793463674796&dl=https%3A%2F%2Fpracticesoftwaretesting.com%2Fproduct%2F01M69B1HW8E19B80PAP2YK9WF0&en=view_item&dt=Combination%20Pliers';
    const draft = buildBugTicketDraft(
      potentialBug('bug-5', {
        page: {
          url: `https://practicesoftwaretesting.com/product/${productId}${productId}?utm=long`,
          pathname: `/product/${productId}${productId}`,
          title:
            'Combination Pliers - Practice Software Testing - Toolshop - v5.0',
        },
        actions: [
          {
            actionId: 'a1',
            step: `Opened the ${productId} page.`,
          },
        ],
        issues: [
          { category: 'ui', issueId: 'u1' },
          { category: 'network', issueId: 'n1' },
        ],
      }),
      {
        uiIssues: [
          uiIssue('u1', {
            visibleMessage: 'BCA second ui alert',
          }),
        ],
        consoleIssues: [],
        networkIssues: [
          networkIssue('n1', {
            url: `https://practicesoftwaretesting.com/g/collect?${collectQuery}`,
            category: 'network-failure',
            status: undefined,
            failureMessage: 'Fetch request failed',
          }),
        ],
      },
    );

    expect(draft.description).toContain('On Combination Pliers');
    expect(draft.description).toContain('Before that:');
    expect(draft.description).toContain('Opened the product page.');
    expect(draft.description).toContain('Shown as a page alert.');
    expect(draft.description).not.toContain('/g/collect');
    expect(draft.description).not.toContain('tid=G-');
    expect(draft.description).not.toContain(collectQuery);
    expect(draft.steps).toEqual(['Opened the product page.']);
    expect(draft.environment).toBe(
      `https://practicesoftwaretesting.com/product/${productId}`,
    );
    expect(draft.environment).not.toContain('utm=');
  });

  it('adds how the console error was recorded when it repeats', () => {
    const draft = buildBugTicketDraft(
      potentialBug('bug-6', {
        issues: [{ category: 'console', issueId: 'c1' }],
      }),
      {
        uiIssues: [],
        consoleIssues: [
          consoleIssue('c1', {
            category: 'uncaught-error',
            occurrenceCount: 3,
          }),
        ],
        networkIssues: [],
      },
    );

    expect(draft.description).toContain('DevTools Console');
    expect(draft.description).toContain('uncaught page error');
    expect(draft.description).toContain('Seen 3 times in this session.');
  });
});
