import type { ConsoleIssueCategory } from '@/src/domain/console-issue';

function normalizeFingerprintMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim();
}

export function extractTopStackLocation(stack: string | undefined): string {
  if (stack === undefined || stack.length === 0) {
    return '';
  }

  const lines = stack.split('\n').map((line) => line.trim());
  for (const line of lines) {
    if (line.length === 0) {
      continue;
    }
    if (line.startsWith('Error') || line.includes('stack')) {
      continue;
    }
    return line;
  }

  return lines[0] ?? '';
}

export function buildConsoleIssueFingerprint(input: {
  category: ConsoleIssueCategory;
  message: string;
  url: string;
  stack?: string;
}): string {
  return [
    input.category,
    normalizeFingerprintMessage(input.message),
    extractTopStackLocation(input.stack),
    input.url,
  ].join('\u0000');
}
