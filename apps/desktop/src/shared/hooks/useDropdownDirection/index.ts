import { useEffect, useState } from 'react';

/**
 * Walks up the DOM until it finds an ancestor that clips overflow
 * (auto/scroll/hidden on Y). That's the box our popover would actually
 * be cut off by, measuring against `window` is misleading when the
 * trigger sits inside a Dialog with `overflow: hidden`.
 */
function findClippingAncestor(el: HTMLElement | null): HTMLElement | null {
  let current = el?.parentElement ?? null;
  while (current) {
    const style = getComputedStyle(current);
    const overflowY = style.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden') {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

export const useDropdownDirection = (
  triggerRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  expectedHeight = 200,
): 'up' | 'down' => {
  const [direction, setDirection] = useState<'up' | 'down'>('down');
  useEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    const rect = el?.getBoundingClientRect();
    if (!el || !rect) return;
    const clipper = findClippingAncestor(el);
    const clipperRect = clipper?.getBoundingClientRect();
    const bottomBound = clipperRect ? clipperRect.bottom : window.innerHeight;
    const topBound = clipperRect ? clipperRect.top : 0;
    const spaceBelow = bottomBound - rect.bottom;
    const spaceAbove = rect.top - topBound;
    setDirection(spaceBelow < expectedHeight && spaceAbove > spaceBelow ? 'up' : 'down');
  }, [open, triggerRef, expectedHeight]);
  return direction;
};
