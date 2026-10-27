import { describe, expect, it } from 'vitest';
import {
  MAX_CONSOLE_MESSAGE_LENGTH,
  MAX_CONSOLE_STACK_LENGTH,
  normalizeConsoleArguments,
} from '@/src/console/normalize-console-args';
import { sanitizeIssueText } from '@/src/console/sanitize-issue-text';

describe('normalize console arguments', () => {
  it('limits argument count and handles circular structures safely', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    const message = normalizeConsoleArguments([
      'hello',
      42,
      circular,
      ...Array.from({ length: 12 }, (_, index) => `arg-${index}`),
    ]);

    expect(message).toContain('hello');
    expect(message).toContain('42');
    expect(message).toContain('[Circular]');
    expect(message.length).toBeLessThanOrEqual(MAX_CONSOLE_MESSAGE_LENGTH);
  });

  it('uses bounded representations for complex values', () => {
    expect(normalizeConsoleArguments([Symbol('x')])).toBe('[Symbol]');
    expect(normalizeConsoleArguments([() => undefined])).toBe('[Function]');
    expect(normalizeConsoleArguments([document.createElement('div')])).toBe(
      '[DOM Node]',
    );
  });

  it('sanitizes sensitive URLs inside messages and stacks', () => {
    const sanitized = sanitizeIssueText(
      'Request failed https://example.com/api?token=secret',
      MAX_CONSOLE_MESSAGE_LENGTH,
    );
    expect(sanitized).toContain('token=%5Bredacted%5D');
    expect(sanitized).not.toContain('secret');

    const stack = sanitizeIssueText(
      `Error: failed\n    at https://example.com/app?password=abc`,
      MAX_CONSOLE_STACK_LENGTH,
    );
    expect(stack).toContain('password=%5Bredacted%5D');
  });
});
