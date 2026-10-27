import { MAX_UI_RULE_SELECTOR_LENGTH } from '@/src/ui/ui-issue-limits';

export function hasBalancedSquareBrackets(selector: string): boolean {
  let depth = 0;
  for (const character of selector) {
    if (character === '[') {
      depth += 1;
    } else if (character === ']') {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
    }
  }
  return depth === 0;
}

function validatesSelectorSyntaxWithCssSupports(selector: string): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
    return false;
  }

  try {
    return CSS.supports('selector', selector);
  } catch {
    return false;
  }
}

function validatesSelectorSyntaxInDocument(selector: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  try {
    document.querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

function hasBalancedParentheses(selector: string): boolean {
  let depth = 0;
  for (const character of selector) {
    if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
    }
  }
  return depth === 0;
}

function fallbackSelectorSyntaxCheck(selector: string): boolean {
  if (!hasBalancedParentheses(selector)) {
    return false;
  }
  if (/^\[\s*\]$/.test(selector)) {
    return false;
  }
  if (/##/.test(selector)) {
    return false;
  }
  for (const character of selector) {
    if (!/[\w#.\s="'():,*+~>|\\\-[\]]/.test(character)) {
      return false;
    }
  }
  return true;
}

export function isValidCssSelector(selector: string): boolean {
  const trimmed = selector.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_UI_RULE_SELECTOR_LENGTH) {
    return false;
  }
  if (!hasBalancedSquareBrackets(trimmed)) {
    return false;
  }
  if (trimmed.includes('>>')) {
    return false;
  }

  if (validatesSelectorSyntaxWithCssSupports(trimmed)) {
    return true;
  }

  if (validatesSelectorSyntaxInDocument(trimmed)) {
    return true;
  }

  return fallbackSelectorSyntaxCheck(trimmed);
}
