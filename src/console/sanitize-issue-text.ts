import { sanitizeUrl } from '@/src/privacy/url-sanitizer';

const URL_IN_TEXT_PATTERN = /https?:\/\/[^\s"'<>]+/gi;

export function sanitizeIssueText(text: string, maxLength: number): string {
  const withSanitizedUrls = text.replace(URL_IN_TEXT_PATTERN, (match) => {
    const trailing = /[),.;]+$/.exec(match);
    const suffix = trailing?.[0] ?? '';
    const core = suffix.length > 0 ? match.slice(0, -suffix.length) : match;
    const sanitized = sanitizeUrl(core);
    return sanitized === null ? '[redacted-url]' : `${sanitized}${suffix}`;
  });

  if (withSanitizedUrls.length <= maxLength) {
    return withSanitizedUrls;
  }

  return `${withSanitizedUrls.slice(0, maxLength - 1)}…`;
}
