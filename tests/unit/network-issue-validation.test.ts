import { describe, expect, it } from 'vitest';
import { parseNetworkIssueSubmissionPayload } from '@/src/network/network-issue-validation';
import { sanitizeUrl } from '@/src/privacy/url-sanitizer';

describe('network issue validation', () => {
  it('accepts already-sanitized http URLs', () => {
    const parsed = parseNetworkIssueSubmissionPayload({
      sessionId: 'session-1',
      timestamp: 1_000,
      source: 'fetch',
      category: 'http-error',
      method: 'GET',
      url: 'https://example.com/api/profile',
      status: 404,
    });

    expect(parsed).toMatchObject({
      url: 'https://example.com/api/profile',
      status: 404,
    });
  });

  it('redacts sensitive query parameters through the URL sanitizer', () => {
    const sanitized = sanitizeUrl('https://example.com/api?token=secret-value');
    expect(sanitized).not.toContain('secret-value');
    expect(
      parseNetworkIssueSubmissionPayload({
        sessionId: 'session-1',
        timestamp: 1_000,
        source: 'fetch',
        category: 'http-error',
        method: 'GET',
        url: sanitized,
        status: 404,
      }),
    ).not.toBeNull();
  });

  it('rejects unsanitized URLs with credentials or raw secrets', () => {
    expect(
      parseNetworkIssueSubmissionPayload({
        sessionId: 'session-1',
        timestamp: 1_000,
        source: 'fetch',
        category: 'http-error',
        method: 'GET',
        url: 'https://user:pass@example.com/api?token=secret',
        status: 404,
      }),
    ).toBeNull();
  });

  it('requires failure messages for non-http categories', () => {
    expect(
      parseNetworkIssueSubmissionPayload({
        sessionId: 'session-1',
        timestamp: 1_000,
        source: 'xhr',
        category: 'timeout',
        method: 'POST',
        url: 'https://example.com/upload',
        failureMessage: 'Request timed out',
      }),
    ).toMatchObject({ category: 'timeout' });
  });
});
