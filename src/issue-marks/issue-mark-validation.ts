import {
  createDefaultIssueMarkSessionData,
  type IssueMark,
  type IssueMarkReportScope,
  type IssueMarkReportScopeWithoutMark,
  type IssueMarkSessionData,
} from '@/src/domain/issue-mark';

function isReportScope(value: unknown): value is IssueMarkReportScope {
  return value === 'around-mark' || value === 'full-session';
}

function isReportScopeWithoutMark(
  value: unknown,
): value is IssueMarkReportScopeWithoutMark {
  return value === 'last-10-actions' || value === 'full-session';
}

function parseRelatedIssue(
  value: unknown,
): IssueMark['relatedIssues'][number] | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const category = (value as { category?: unknown }).category;
  const issueId = (value as { issueId?: unknown }).issueId;
  if (
    (category !== 'ui' && category !== 'console' && category !== 'network') ||
    typeof issueId !== 'string' ||
    issueId.length === 0
  ) {
    return null;
  }
  return { category, issueId };
}

function parseIssueMark(value: unknown): IssueMark | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.sessionId !== 'string' ||
    typeof record.markedAt !== 'number' ||
    typeof record.pageUrl !== 'string' ||
    typeof record.pathname !== 'string' ||
    !Array.isArray(record.actionIds) ||
    !Array.isArray(record.relatedIssues) ||
    !isReportScope(record.reportScope)
  ) {
    return null;
  }
  const actionIds = record.actionIds.filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  const relatedIssues = record.relatedIssues
    .map(parseRelatedIssue)
    .filter(
      (item): item is IssueMark['relatedIssues'][number] => item !== null,
    );
  const note =
    typeof record.note === 'string' && record.note.trim().length > 0
      ? record.note
      : undefined;
  const pageTitle =
    typeof record.pageTitle === 'string' && record.pageTitle.trim().length > 0
      ? record.pageTitle
      : undefined;

  return {
    sessionId: record.sessionId,
    markedAt: record.markedAt,
    note,
    pageUrl: record.pageUrl,
    pageTitle,
    pathname: record.pathname,
    actionIds,
    relatedIssues,
    reportScope: record.reportScope,
  };
}

export function parseIssueMarkSessionData(
  value: unknown,
): IssueMarkSessionData | null {
  if (value === undefined || value === null) {
    return createDefaultIssueMarkSessionData();
  }
  if (typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const reportScopeWithoutMark = record.reportScopeWithoutMark;
  if (
    reportScopeWithoutMark !== undefined &&
    !isReportScopeWithoutMark(reportScopeWithoutMark)
  ) {
    return null;
  }
  if (record.mark === undefined || record.mark === null) {
    return {
      mark: null,
      reportScopeWithoutMark:
        reportScopeWithoutMark ??
        createDefaultIssueMarkSessionData().reportScopeWithoutMark,
    };
  }
  const mark = parseIssueMark(record.mark);
  if (mark === null) {
    return null;
  }
  return {
    mark,
    reportScopeWithoutMark:
      reportScopeWithoutMark ??
      createDefaultIssueMarkSessionData().reportScopeWithoutMark,
  };
}
