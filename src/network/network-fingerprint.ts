import type {
  NetworkIssueCategory,
  NetworkIssueSource,
} from '@/src/domain/network-issue';

export function buildNetworkIssueFingerprint(input: {
  source: NetworkIssueSource;
  category: NetworkIssueCategory;
  method: string;
  url: string;
  status?: number;
}): string {
  const statusPart = input.status !== undefined ? String(input.status) : '';
  return [
    input.source,
    input.category,
    input.method.toUpperCase(),
    input.url,
    statusPart,
  ].join('\u0000');
}
