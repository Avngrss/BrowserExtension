import { ISSUE_MARK_NOTE_MAX_LENGTH } from '@/src/domain/issue-mark';

export function normalizeIssueMarkNote(raw: string): string {
  return raw.replace(/\r\n/g, '\n').trim();
}

export function validateIssueMarkNote(raw: string): string | undefined {
  const normalized = normalizeIssueMarkNote(raw);
  if (normalized.length === 0) {
    return undefined;
  }
  if (normalized.length > ISSUE_MARK_NOTE_MAX_LENGTH) {
    return `Note must be ${ISSUE_MARK_NOTE_MAX_LENGTH} characters or fewer.`;
  }
  return undefined;
}

export function issueMarkNoteForSave(
  raw: string | undefined,
): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const normalized = normalizeIssueMarkNote(raw);
  if (normalized.length === 0) {
    return undefined;
  }
  return normalized;
}
