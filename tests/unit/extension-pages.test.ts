import { describe, expect, it } from 'vitest';
import {
  SETTINGS_OPEN_FAILED_MESSAGE,
  SIDE_PANEL_UNSUPPORTED_MESSAGE,
  toInlineError,
} from '@/src/utils/extension-pages';

describe('inline extension errors', () => {
  it('keeps known short messages', () => {
    expect(
      toInlineError(
        new Error(SIDE_PANEL_UNSUPPORTED_MESSAGE),
        SETTINGS_OPEN_FAILED_MESSAGE,
      ),
    ).toBe(SIDE_PANEL_UNSUPPORTED_MESSAGE);
  });

  it('replaces unknown failures with the fallback', () => {
    expect(
      toInlineError(
        new Error('chrome.sidePanel.open failed: gesture'),
        SETTINGS_OPEN_FAILED_MESSAGE,
      ),
    ).toBe(SETTINGS_OPEN_FAILED_MESSAGE);
    expect(toInlineError('nope', SETTINGS_OPEN_FAILED_MESSAGE)).toBe(
      SETTINGS_OPEN_FAILED_MESSAGE,
    );
  });
});
