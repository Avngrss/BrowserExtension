import type { CapturedAction } from '@/src/domain/action';
import {
  describeClickWithoutLabel,
  describeElementKindForField,
  resolveActionElementLabel,
} from '@/src/actions/action-report-element-label';
import {
  formatActionTimelinePath,
  looksLikeOpaqueId,
} from '@/src/privacy/timeline-url';

function pagePhraseFromPath(pathname: string): string {
  const pathOnly = pathname.split('?')[0] ?? pathname;
  const segments = pathOnly
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter((part) => part.length > 0);
  if (segments.length === 0) {
    return 'home';
  }
  let segment = segments[segments.length - 1]!;
  if (looksLikeOpaqueId(segment) && segments.length >= 2) {
    segment = segments[segments.length - 2]!;
  }
  if (looksLikeOpaqueId(segment)) {
    return 'page';
  }
  return segment.replace(/[-_]+/g, ' ');
}

export function rewriteOpaqueNavigationStep(
  step: string,
  pagePathname: string,
): string {
  const match = /^Opened the (.+) page\.?$/.exec(step.trim());
  const name = match?.[1];
  if (name === undefined) {
    return step;
  }
  if (!looksLikeOpaqueId(name.replace(/\s+/g, ''))) {
    return step;
  }
  return `Opened the ${pagePhraseFromPath(pagePathname)} page.`;
}

export function describeActionReportStep(action: CapturedAction): string {
  if (action.type === 'navigation') {
    const path = formatActionTimelinePath(action.url);
    const page = pagePhraseFromPath(path);
    return `Opened the ${page} page.`;
  }

  const elementType = describeElementKindForField(action.element);
  const name = resolveActionElementLabel(action);

  if (action.type === 'submit') {
    return name !== undefined
      ? `Submitted the “${name}” form.`
      : 'Submitted a form.';
  }

  if (action.type === 'input') {
    if (name !== undefined) {
      return `Entered a value in the ${name} field.`;
    }
    return `Entered a value in the ${elementType} field.`;
  }

  if (action.type === 'change') {
    if (elementType === 'combobox') {
      return name !== undefined
        ? `Selected “${name}” in the ${elementType}.`
        : `Selected an option in the ${elementType}.`;
    }
    if (elementType === 'checkbox' || elementType === 'radio') {
      return name !== undefined
        ? `Selected the ${elementType} “${name}”.`
        : `Changed the ${elementType}.`;
    }
    if (action.element.inputType === 'file') {
      return name !== undefined
        ? `Selected a file in the “${name}” file input.`
        : 'Selected a file in the file input.';
    }
    return name !== undefined
      ? `Changed the ${elementType} “${name}”.`
      : `Changed the ${elementType}.`;
  }

  if (name !== undefined) {
    return `Clicked “${name}”.`;
  }
  return describeClickWithoutLabel(action.element);
}
