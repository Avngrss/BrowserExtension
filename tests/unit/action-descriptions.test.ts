import { describe, expect, it } from 'vitest';
import { describeCapturedAction } from '@/src/actions/action-descriptions';

describe('action descriptions', () => {
  it('uses semantic element types instead of raw tags', () => {
    expect(
      describeCapturedAction({
        id: 'action-1',
        type: 'click',
        sessionId: 'session-1',
        timestamp: 1,
        url: 'https://example.com/',
        element: {
          tagName: 'a',
          semanticType: 'link',
          accessibleName: 'Test Cases',
        },
      }),
    ).toBe('Clicked link “Test Cases”');

    expect(
      describeCapturedAction({
        id: 'action-2',
        type: 'click',
        sessionId: 'session-1',
        timestamp: 2,
        url: 'https://example.com/',
        element: {
          tagName: 'button',
          semanticType: 'button',
          accessibleName: 'Submit order',
        },
      }),
    ).toBe('Clicked button “Submit order”');
  });

  it('describes input and change actions without captured values', () => {
    expect(
      describeCapturedAction({
        id: 'action-input',
        type: 'input',
        sessionId: 'session-1',
        timestamp: 1,
        url: 'https://example.com/',
        element: {
          tagName: 'input',
          semanticType: 'textbox',
          accessibleName: 'Email',
        },
      }),
    ).toBe('Entered value into textbox “Email”');

    expect(
      describeCapturedAction({
        id: 'action-change',
        type: 'change',
        sessionId: 'session-1',
        timestamp: 2,
        url: 'https://example.com/',
        checked: true,
        element: {
          tagName: 'input',
          semanticType: 'checkbox',
          accessibleName: 'Subscribe',
        },
      }),
    ).toBe('Changed checkbox “Subscribe”');
  });

  it('describes select changes using the field label, not option text', () => {
    expect(
      describeCapturedAction({
        id: 'action-select',
        type: 'change',
        sessionId: 'session-1',
        timestamp: 1,
        url: 'https://example.com/signup',
        element: {
          tagName: 'select',
          semanticType: 'combobox',
          accessibleName: 'Country',
          visibleText: 'India United States Canada',
        },
      }),
    ).toBe('Selected option in combobox “Country”');

    expect(
      describeCapturedAction({
        id: 'action-select-unlabeled',
        type: 'change',
        sessionId: 'session-1',
        timestamp: 2,
        url: 'https://example.com/signup',
        element: {
          tagName: 'select',
          semanticType: 'combobox',
          visibleText: 'India United States',
        },
      }),
    ).toBe('Selected option in combobox');
  });

  it('does not use href or raw html as names', () => {
    expect(
      describeCapturedAction({
        id: 'action-3',
        type: 'submit',
        sessionId: 'session-1',
        timestamp: 3,
        url: 'https://example.com/checkout',
        element: {
          tagName: 'form',
          semanticType: 'form',
          accessibleName: 'Checkout',
        },
      }),
    ).toBe('Submitted form “Checkout”');
  });
});
