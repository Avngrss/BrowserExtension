import { describe, expect, it } from 'vitest';
import {
  getSemanticElementType,
  inferSemanticElementType,
} from '@/src/capture/element-semantic';

describe('element semantic types', () => {
  it('prefers explicit ARIA roles', () => {
    expect(inferSemanticElementType('div', { role: 'button' })).toBe('button');
  });

  it('infers implicit roles for common controls', () => {
    expect(inferSemanticElementType('a', { hasHref: true })).toBe('link');
    expect(inferSemanticElementType('button')).toBe('button');
    expect(inferSemanticElementType('input', { inputType: 'checkbox' })).toBe(
      'checkbox',
    );
    expect(inferSemanticElementType('select')).toBe('combobox');
    expect(inferSemanticElementType('textarea')).toBe('textbox');
    expect(inferSemanticElementType('form')).toBe('form');
  });

  it('uses stored semanticType in descriptors', () => {
    expect(
      getSemanticElementType({
        tagName: 'a',
        semanticType: 'link',
      }),
    ).toBe('link');
  });

  it('ignores stored html tag names and unknown tags', () => {
    expect(
      getSemanticElementType({
        tagName: 'a',
        semanticType: 'a',
      }),
    ).toBe('link');
    expect(inferSemanticElementType('div')).toBe('control');
  });
});
