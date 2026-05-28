import { useEffect, useState } from 'react';
import type { VerbosityLevel } from '../../settings/verbosity';

export const MODEL_COST_DOT: Record<string, string> = {
  cheap: 'bg-emerald-400',
  mid: 'bg-amber-400',
  premium: 'bg-rose-400',
};

export const VERBOSITY_DOT: Record<VerbosityLevel, string> = {
  brief: 'bg-emerald-400',
  normal: 'bg-amber-400',
  verbose: 'bg-rose-400',
};

export function modelCostTier(modelId: string): 'cheap' | 'mid' | 'premium' {
  if (/haiku|mini|fast/i.test(modelId)) return 'cheap';
  if (/opus/i.test(modelId)) return 'premium';
  return 'mid';
}

export function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose]);
}

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

/**
 * Picks the opening direction based on the trigger's position relative
 * to its nearest clipping ancestor. Avoids the bottom-of-scroll-container
 * trap where `top-full` would push the popover into a hidden region.
 */
export function useDropdownDirection(
  triggerRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  expectedHeight = 200,
): 'up' | 'down' {
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
}

export const POPUP_BASE =
  'absolute left-0 z-50 w-full rounded-md border border-border bg-subtle py-0.5 shadow-lg';
export const POPUP_DOWN = 'top-full mt-1';
export const POPUP_UP = 'bottom-full mb-1';
