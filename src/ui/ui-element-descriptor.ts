import type { SafeElementDescriptor } from '@/src/domain/action';
import { buildSafeElementDescriptor } from '@/src/capture/element-descriptor';

export function buildUiIssueElementDescriptor(
  element: Element,
): SafeElementDescriptor {
  const descriptor = buildSafeElementDescriptor(element);
  return {
    tagName: descriptor.tagName,
    ...(descriptor.semanticType !== undefined
      ? { semanticType: descriptor.semanticType }
      : {}),
    ...(descriptor.role !== undefined ? { role: descriptor.role } : {}),
    ...(descriptor.accessibleName !== undefined
      ? { accessibleName: descriptor.accessibleName }
      : {}),
    ...(descriptor.testId !== undefined ? { testId: descriptor.testId } : {}),
    ...(descriptor.inputType !== undefined
      ? { inputType: descriptor.inputType }
      : {}),
  };
}
