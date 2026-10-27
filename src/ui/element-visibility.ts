export function isElementVisible(element: Element): boolean {
  if (!element.isConnected) {
    return false;
  }

  const style = getComputedStyle(element);
  if (style.display === 'none') {
    return false;
  }
  if (style.visibility === 'hidden' || style.visibility === 'collapse') {
    return false;
  }
  if (style.opacity === '0') {
    return false;
  }

  const rect = element.getClientRects();
  if (rect.length === 0) {
    return false;
  }

  return true;
}
