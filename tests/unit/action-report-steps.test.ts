import { describe, expect, it } from 'vitest';
import {
  describeActionReportStep,
  rewriteOpaqueNavigationStep,
} from '@/src/actions/action-report-steps';

describe('describeActionReportStep', () => {
  it('formats navigation and clicks without sensitive values', () => {
    expect(
      describeActionReportStep({
        id: 'a1',
        sessionId: 's1',
        timestamp: 1,
        type: 'navigation',
        url: 'https://example.test/products',
      }),
    ).toBe('Opened the products page.');

    expect(
      describeActionReportStep({
        id: 'a1b',
        sessionId: 's1',
        timestamp: 1,
        type: 'navigation',
        url: 'https://example.test/product/01M69B1HW8E19B80PAP2YK9WF0',
      }),
    ).toBe('Opened the product page.');

    expect(
      describeActionReportStep({
        id: 'a2',
        sessionId: 's1',
        timestamp: 2,
        type: 'click',
        url: 'https://example.test/products',
        element: { tagName: 'button', accessibleName: 'Add to cart' },
      }),
    ).toBe('Clicked “Add to cart”.');
  });

  it('uses semantic fallbacks instead of raw tag names for unnamed clicks', () => {
    expect(
      describeActionReportStep({
        id: 'a4',
        sessionId: 's1',
        timestamp: 4,
        type: 'click',
        url: 'https://example.test/',
        element: { tagName: 'a', semanticType: 'a' },
      }),
    ).toBe('Clicked a link.');

    expect(
      describeActionReportStep({
        id: 'a5',
        sessionId: 's1',
        timestamp: 5,
        type: 'click',
        url: 'https://example.test/',
        element: { tagName: 'a', visibleText: 'Proceed To Checkout' },
      }),
    ).toBe('Clicked “Proceed To Checkout”.');
  });

  it('describes redacted field input without entered text', () => {
    expect(
      describeActionReportStep({
        id: 'a3',
        sessionId: 's1',
        timestamp: 3,
        type: 'input',
        url: 'https://example.test/signup',
        redacted: true,
        element: {
          tagName: 'input',
          accessibleName: 'Email',
          inputType: 'email',
        },
      }),
    ).toBe('Entered a value in the Email field.');
  });

  it('rewrites a stored opaque navigation step using the page path', () => {
    expect(
      rewriteOpaqueNavigationStep(
        'Opened the 01M69B1HW8E19B80PAP2YK9WF0 page.',
        '/product/01M69B1HW8E19B80PAP2YK9WF0',
      ),
    ).toBe('Opened the product page.');
  });
});
