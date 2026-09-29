import { useLayoutEffect, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';

type Direction = 'up' | 'down';

type Align = 'start' | 'end' | 'center';

type Params = {
  readonly triggerRef: RefObject<HTMLElement | null>;
  readonly popupRef: RefObject<HTMLElement | null>;
  readonly open: boolean;
  readonly expectedHeight: number;
  readonly expectedWidth: number;
  readonly align: Align;
  readonly shouldMatchTriggerWidth: boolean;
  readonly isAtLeastTriggerWidth?: boolean;
  readonly viewportMargin?: number;
  readonly maxWidth?: number;
};

type ResolveDesiredLeftParams = {
  readonly rect: DOMRect;
  readonly popupWidth: number;
  readonly align: Align;
};

const DEFAULT_VIEWPORT_MARGIN = 8;
const DROPDOWN_GAP = 4;
const MIN_DROPDOWN_HEIGHT = 160;
const MIN_TRIGGER_MATCH_WIDTH = 160;
const BOTTOM_INSET_PROPERTY = '--dropdown-bottom-inset';

const readBottomInset = (): number => {
  const parsed = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(BOTTOM_INSET_PROPERTY),
  );
  return Number.isNaN(parsed) ? 0 : parsed;
};

const resolveDesiredLeft = ({ rect, popupWidth, align }: ResolveDesiredLeftParams): number => {
  if (align === 'end') {
    return rect.right - popupWidth;
  }
  if (align === 'center') {
    return rect.left + rect.width / 2 - popupWidth / 2;
  }
  return rect.left;
};

export const useDropdownDirection = ({
  triggerRef,
  popupRef,
  open,
  expectedHeight,
  expectedWidth,
  align,
  shouldMatchTriggerWidth,
  isAtLeastTriggerWidth = false,
  viewportMargin = DEFAULT_VIEWPORT_MARGIN,
  maxWidth,
}: Params): CSSProperties | undefined => {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (trigger == null) {
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = Math.max(window.innerWidth - viewportMargin * 2, 0);
      const matchedWidth = Math.max(rect.width, MIN_TRIGGER_MATCH_WIDTH);
      const measuredWidth = popupRef.current?.getBoundingClientRect().width ?? 0;
      const flowWidth = measuredWidth > 0 ? measuredWidth : expectedWidth;
      const popupWidth = Math.min(
        shouldMatchTriggerWidth ? matchedWidth : flowWidth,
        viewportWidth,
      );
      const desiredLeft = resolveDesiredLeft({ rect, popupWidth, align });
      const maxLeft = Math.max(window.innerWidth - popupWidth - viewportMargin, viewportMargin);
      const left = Math.min(Math.max(desiredLeft, viewportMargin), maxLeft);
      const spaceBelow = Math.max(
        window.innerHeight - rect.bottom - DROPDOWN_GAP - viewportMargin - readBottomInset(),
        0,
      );
      const spaceAbove = Math.max(rect.top - DROPDOWN_GAP - viewportMargin, 0);
      const measuredHeight = popupRef.current?.getBoundingClientRect().height ?? 0;
      const popupHeight = measuredHeight > 0 ? measuredHeight : expectedHeight;
      const direction: Direction =
        spaceBelow >= MIN_DROPDOWN_HEIGHT || spaceBelow >= spaceAbove
          ? spaceBelow < popupHeight && spaceAbove > spaceBelow
            ? 'up'
            : 'down'
          : 'up';
      const availableHeight = direction === 'down' ? spaceBelow : spaceAbove;
      const maxHeight = Math.max(availableHeight, 0);

      setStyle({
        top: direction === 'down' ? rect.bottom + DROPDOWN_GAP : undefined,
        bottom: direction === 'up' ? window.innerHeight - rect.top + DROPDOWN_GAP : undefined,
        left,
        maxWidth: maxWidth === undefined ? viewportWidth : Math.min(maxWidth, viewportWidth),
        maxHeight,
        ...(shouldMatchTriggerWidth ? { width: popupWidth } : {}),
        ...(isAtLeastTriggerWidth ? { minWidth: Math.min(rect.width, viewportWidth) } : {}),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updatePosition);
    if (popupRef.current != null) {
      observer?.observe(popupRef.current);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      observer?.disconnect();
    };
  }, [
    align,
    expectedHeight,
    expectedWidth,
    isAtLeastTriggerWidth,
    maxWidth,
    open,
    popupRef,
    shouldMatchTriggerWidth,
    triggerRef,
    viewportMargin,
  ]);

  return style;
};
