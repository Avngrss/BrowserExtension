import { describe, expect, it } from 'vitest';
import { buildSafeElementDescriptor } from '@/src/capture/element-descriptor';

describe('element descriptor', () => {
  it('omits sensitive visible text and accessible values', () => {
    const input = document.createElement('input');
    input.type = 'password';
    input.value = 'secret-value';
    input.setAttribute('aria-label', 'Password');

    expect(buildSafeElementDescriptor(input)).toEqual({
      tagName: 'input',
      semanticType: 'textbox',
      inputType: 'password',
    });
  });

  it('uses the associated label for select instead of option text', () => {
    const select = document.createElement('select');
    select.id = 'country-select';
    const label = document.createElement('label');
    label.htmlFor = 'country-select';
    label.textContent = 'Country';
    document.body.append(label, select);

    select.innerHTML =
      '<option value="in">India</option><option value="us">United States</option>';

    expect(buildSafeElementDescriptor(select)).toEqual({
      tagName: 'select',
      semanticType: 'combobox',
      accessibleName: 'Country',
    });
  });

  it('does not derive select names from option text', () => {
    const select = document.createElement('select');
    select.innerHTML =
      '<option value="in">India</option><option value="us">United States</option>';

    expect(buildSafeElementDescriptor(select)).toEqual({
      tagName: 'select',
      semanticType: 'combobox',
    });
  });

  it('captures safe labels and test ids', () => {
    const button = document.createElement('button');
    button.textContent = 'Submit order';
    button.setAttribute('data-testid', 'checkout-submit');

    expect(buildSafeElementDescriptor(button)).toMatchObject({
      tagName: 'button',
      semanticType: 'button',
      visibleText: 'Submit order',
      testId: 'checkout-submit',
    });
  });
});
