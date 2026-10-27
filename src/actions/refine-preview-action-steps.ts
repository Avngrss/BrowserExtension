function normalizePhrase(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

const CLICKED_STEP = /^Clicked “(.+)”\.$/;
const OPENED_PAGE_STEP = /^Opened the (.+) page\.$/;

function phrasesMatchNavigation(
  clickLabel: string,
  openPhrase: string,
): boolean {
  const click = normalizePhrase(clickLabel);
  const opened = normalizePhrase(openPhrase);
  return click === opened || opened.includes(click) || click.includes(opened);
}

const GENERIC_UNNAMED_CLICKS = new Set([
  'Clicked a control.',
  'Clicked a link.',
  'Clicked a button.',
]);

export function refinePreviewActionSteps(steps: string[]): string[] {
  return refineActionStepEntries(steps.map((step) => ({ step }))).map(
    (entry) => entry.step,
  );
}

export function refineActionStepEntries<T extends { step: string }>(
  entries: T[],
): T[] {
  const withoutAdjacentDuplicates: T[] = [];
  for (const entry of entries) {
    const previous = withoutAdjacentDuplicates.at(-1);
    if (previous === undefined || previous.step !== entry.step) {
      withoutAdjacentDuplicates.push(entry);
    }
  }

  const merged: T[] = [];
  let index = 0;
  while (index < withoutAdjacentDuplicates.length) {
    const current = withoutAdjacentDuplicates[index];
    const next = withoutAdjacentDuplicates[index + 1];
    if (current !== undefined && next !== undefined) {
      const clickMatch = CLICKED_STEP.exec(current.step);
      const openMatch = OPENED_PAGE_STEP.exec(next.step);
      if (
        clickMatch !== null &&
        openMatch !== null &&
        phrasesMatchNavigation(clickMatch[1] ?? '', openMatch[1] ?? '')
      ) {
        merged.push(next);
        index += 2;
        continue;
      }
    }
    if (current !== undefined) {
      merged.push(current);
    }
    index += 1;
  }
  return merged.filter((entry) => !GENERIC_UNNAMED_CLICKS.has(entry.step));
}

export function isMeaninglessGenericClickStep(step: string): boolean {
  return GENERIC_UNNAMED_CLICKS.has(step);
}
