import { describe, expect, it } from 'vitest';
import { formatActionTimelinePath } from '@/src/privacy/timeline-url';
import { sanitizeUrl } from '@/src/privacy/url-sanitizer';

describe('formatActionTimelinePath', () => {
  it('renders pathname and non-sensitive query parameters only', () => {
    const stored = sanitizeUrl(
      'https://example.com/signup?ref=home&token=secret#section',
    );
    expect(stored).toBe(
      'https://example.com/signup?ref=home&token=%5Bredacted%5D',
    );
    expect(formatActionTimelinePath(stored!)).toBe(
      '/signup?ref=home&token=%5Bredacted%5D',
    );
  });

  it('uses / for the root path', () => {
    expect(formatActionTimelinePath('https://example.com')).toBe('/');
  });
});
