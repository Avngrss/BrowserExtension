import type { SafeElementDescriptor } from '@/src/domain/action';
import { normalizeUiMessageForFingerprint } from '@/src/ui/ui-visible-message';

export function buildUiIssueFingerprint(input: {
  ruleId: string;
  url: string;
  element: SafeElementDescriptor;
  visibleMessage?: string;
}): string {
  const accessibleName = normalizeUiMessageForFingerprint(
    input.element.accessibleName,
  );
  const message = normalizeUiMessageForFingerprint(input.visibleMessage);
  const semanticType = input.element.semanticType ?? input.element.tagName;

  return [input.ruleId, input.url, semanticType, accessibleName, message].join(
    '\u0000',
  );
}
