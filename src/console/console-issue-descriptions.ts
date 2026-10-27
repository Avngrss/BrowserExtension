import type { ConsoleIssue } from '@/src/domain/console-issue';

export function describeConsoleIssue(issue: ConsoleIssue): string {
  switch (issue.category) {
    case 'console-error':
      return `Console error: ${issue.message}`;
    case 'uncaught-error':
      return `Uncaught error: ${issue.message}`;
    case 'unhandled-rejection':
      return `Unhandled rejection: ${issue.message}`;
  }
}
