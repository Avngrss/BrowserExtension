import { describe, expect, it } from 'vitest';
import { sanitizeUrl } from '@/src/privacy/url-sanitizer';

describe('url sanitizer', () => {
  it('removes hash values and redacts sensitive query parameters', () => {
    expect(
      sanitizeUrl(
        'https://example.com/checkout?step=payment&token=abc#section',
      ),
    ).toBe('https://example.com/checkout?step=payment&token=%5Bredacted%5D');
  });

  it('removes credentials from URLs', () => {
    expect(sanitizeUrl('https://user:secret@example.com/path')).toBe(
      'https://example.com/path',
    );
  });

  it('rejects unsupported protocols', () => {
    expect(sanitizeUrl('chrome-extension://id/page')).toBeNull();
  });
});
