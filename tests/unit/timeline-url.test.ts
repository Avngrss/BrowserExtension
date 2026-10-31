import { describe, expect, it } from 'vitest';
import {
  collapseDuplicatedPathSegment,
  formatActionTimelinePath,
  formatTicketEnvironmentUrl,
  looksLikeOpaqueId,
} from '@/src/privacy/timeline-url';
import { sanitizeUrl } from '@/src/privacy/url-sanitizer';

describe('formatActionTimelinePath', () => {
  it('keeps pathname and a short non-sensitive query', () => {
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

  it('drops a long analytics query string', () => {
    const collect =
      'https://practicesoftwaretesting.com/g/collect?v=2&tid=G-0BJFXRKTYC&gtm=45je6as1v9184871799za200zd9184871799xf1&_p=1793463674796&gcd=13l3l3l2l1l1&npa=1&dl=https%3A%2F%2Fpracticesoftwaretesting.com%2Fproduct%2F01M69B1HW8E19B80PAP2YK9WF0&en=view_item';
    expect(formatActionTimelinePath(collect)).toBe('/g/collect');
  });

  it('uses / for the root path', () => {
    expect(formatActionTimelinePath('https://example.com')).toBe('/');
  });
});

describe('formatTicketEnvironmentUrl', () => {
  it('returns origin and pathname without query or hash', () => {
    expect(
      formatTicketEnvironmentUrl('https://shop.test/product/abc?utm=1#reviews'),
    ).toBe('https://shop.test/product/abc');
  });

  it('collapses a duplicated opaque id in the path', () => {
    const id = '01M69B1HW8E19B80PAP2YK9WF0';
    expect(
      formatTicketEnvironmentUrl(
        `https://practicesoftwaretesting.com/product/${id}${id}`,
      ),
    ).toBe(`https://practicesoftwaretesting.com/product/${id}`);
  });
});

describe('looksLikeOpaqueId', () => {
  it('recognizes ULID-style product ids', () => {
    expect(looksLikeOpaqueId('01M69B1HW8E19B80PAP2YK9WF0')).toBe(true);
    expect(looksLikeOpaqueId('product')).toBe(false);
  });
});

describe('collapseDuplicatedPathSegment', () => {
  it('leaves an ordinary path unchanged', () => {
    expect(collapseDuplicatedPathSegment('/checkout')).toBe('/checkout');
  });
});
