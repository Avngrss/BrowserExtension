import { describe, expect, it } from 'vitest';
import { refinePreviewActionSteps } from '@/src/actions/refine-preview-action-steps';

describe('refinePreviewActionSteps', () => {
  it('removes adjacent duplicate descriptions', () => {
    expect(
      refinePreviewActionSteps([
        'Clicked “Submit”.',
        'Clicked “Submit”.',
        'Clicked “Cancel”.',
      ]),
    ).toEqual(['Clicked “Submit”.', 'Clicked “Cancel”.']);
  });

  it('merges matching navigation click and open page steps', () => {
    expect(
      refinePreviewActionSteps([
        'Clicked “Products”.',
        'Opened the Products page.',
      ]),
    ).toEqual(['Opened the Products page.']);
  });

  it('keeps unrelated consecutive steps separate', () => {
    expect(
      refinePreviewActionSteps(['Clicked “Products”.', 'Clicked “Cart”.']),
    ).toEqual(['Clicked “Products”.', 'Clicked “Cart”.']);
  });

  it('omits generic unnamed click steps from preview', () => {
    expect(
      refinePreviewActionSteps(['Clicked a link.', 'Clicked a button.']),
    ).toEqual([]);
    expect(
      refinePreviewActionSteps([
        'Clicked “Products”.',
        'Opened the Products page.',
      ]),
    ).toEqual(['Opened the Products page.']);
  });

  it('does not merge navigation when labels differ', () => {
    expect(
      refinePreviewActionSteps([
        'Clicked “Shop”.',
        'Opened the Products page.',
      ]),
    ).toEqual(['Clicked “Shop”.', 'Opened the Products page.']);
  });
});
