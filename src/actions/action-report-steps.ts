import type { CapturedAction } from '@/src/domain/action';
import {
  describeClickWithoutLabel,
  describeElementKindForField,
  resolveActionElementLabel,
} from '@/src/actions/action-report-element-label';
import { formatActionTimelinePath } from '@/src/privacy/timeline-url';

function pagePhraseFromPath(pathname: string): string {
  const segment = pathname
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .pop();
  if (segment === undefined || segment.length === 0) {
    return 'home';
  }
  return segment.replace(/[-_]+/g, ' ');
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
