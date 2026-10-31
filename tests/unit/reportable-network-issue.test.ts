import { describe, expect, it } from 'vitest';
import { isReportableNetworkIssue } from '@/src/bug-report/reportable-network-issue';
import { networkIssue } from '../helpers/potential-bug-fixtures';

describe('isReportableNetworkIssue', () => {
  it('accepts HTTP 4xx/5xx and transport failures', () => {
    expect(isReportableNetworkIssue(networkIssue('n1'))).toBe(true);
    expect(
      isReportableNetworkIssue(
        networkIssue('n2', {
          category: 'timeout',
          status: undefined,
        }),
      ),
    ).toBe(true);
  });

  it('rejects successful analytics-style responses', () => {
    expect(
      isReportableNetworkIssue(
        networkIssue('n3', {
          url: 'https://shop.test/g/collect',
          status: 200,
        }),
      ),
    ).toBe(false);
  });
});
