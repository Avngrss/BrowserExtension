import type { ActiveSessionSnapshot } from '@/src/domain/session';
import { sanitizeUrl } from '@/src/privacy/url-sanitizer';
import { truncateCapturedText } from '@/src/privacy/text-sanitizer';

export type PageContextInput = {
  url: string;
  pageTitle?: string;
  updatedAt: number;
};

export function buildPageContextUpdate(
  session: ActiveSessionSnapshot,
  input: PageContextInput,
): ActiveSessionSnapshot | null {
  const sanitizedUrl = sanitizeUrl(input.url);
  if (sanitizedUrl === null) {
    return null;
  }

  const pageTitle =
    input.pageTitle !== undefined
      ? truncateCapturedText(input.pageTitle.trim())
      : undefined;
  const normalizedTitle =
    pageTitle !== undefined && pageTitle.length > 0 ? pageTitle : undefined;

  if (
    session.targetUrl === sanitizedUrl &&
    session.pageTitle === normalizedTitle &&
    session.pageContextUpdatedAt === input.updatedAt
  ) {
    return null;
  }

  return {
    ...session,
    targetUrl: sanitizedUrl,
    pageTitle: normalizedTitle,
    pageContextUpdatedAt: input.updatedAt,
  };
}
