import { useLayoutEffect, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { placeFloating } from './placeFloating';

export type DropdownSide = 'bottom' | 'right' | 'left';

export type DropdownAlign = 'start' | 'end';

type Params = {
  readonly triggerRef: RefObject<HTMLElement | null>;
  readonly popupRef: RefObject<HTMLElement | null>;
  readonly open: boolean;
  readonly expectedHeight: number;
  readonly expectedWidth: number;
  readonly side?: DropdownSide;
  readonly align: DropdownAlign;
  readonly shouldMatchTriggerWidth: boolean;
  readonly isAtLeastTriggerWidth?: boolean;
  readonly isAnchorWrapper?: boolean;
  readonly viewportMargin?: number;
  readonly maxWidth?: number;
};

type AnchorRectParams = {
  readonly trigger: HTMLElement;
  readonly isAnchorWrapper: boolean;
};

const DEFAULT_VIEWPORT_MARGIN = 8;
const DROPDOWN_GAP = 4;
const SIDE_GAP = 8;
const MIN_DROPDOWN_HEIGHT = 160;
const MIN_TRIGGER_MATCH_WIDTH = 160;
const BOTTOM_INSET_PROPERTY = '--dropdown-bottom-inset';

const readBottomInset = (): number => {
  const parsed = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(BOTTOM_INSET_PROPERTY),
  );
  return Number.isNaN(parsed) ? 0 : parsed;
};

const anchorRectOf = ({ trigger, isAnchorWrapper }: AnchorRectParams): DOMRect => {
  const own = trigger.getBoundingClientRect();
  const only =
    isAnchorWrapper && trigger.childElementCount === 1 ? trigger.firstElementChild : null;
  if (only === null) {
    return own;
  }
  const inner = only.getBoundingClientRect();
  return inner.width > 0 || inner.height > 0 ? inner : own;
};

export const useDropdownDirection = ({
  triggerRef,
  popupRef,
  open,
  expectedHeight,
  expectedWidth,
  side = 'bottom',
  align,
  shouldMatchTriggerWidth,
  isAtLeastTriggerWidth = false,
  isAnchorWrapper = false,
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
      const rect = anchorRectOf({ trigger, isAnchorWrapper });
      const viewportWidth = Math.max(window.innerWidth - viewportMargin * 2, 0);
      const matchedWidth = Math.max(rect.width, MIN_TRIGGER_MATCH_WIDTH);
      const measuredWidth = popupRef.current?.getBoundingClientRect().width ?? 0;
      const flowWidth = measuredWidth > 0 ? measuredWidth : expectedWidth;
      const popupWidth = Math.min(
        shouldMatchTriggerWidth ? matchedWidth : flowWidth,
        viewportWidth,
      );
      const measuredHeight = popupRef.current?.getBoundingClientRect().height ?? 0;
      const popupHeight = measuredHeight > 0 ? measuredHeight : expectedHeight;
      const shownMaxWidth =
        maxWidth === undefined ? viewportWidth : Math.min(maxWidth, viewportWidth);
      const placed = placeFloating({
        anchor: rect,
        tip: { width: popupWidth, height: popupHeight },
        side,
        gap: side === 'bottom' ? DROPDOWN_GAP : SIDE_GAP,
        edge: viewportMargin,
        alignment: align,
        minHeight: MIN_DROPDOWN_HEIGHT,
        bottomInset: readBottomInset(),
        viewport: { width: window.innerWidth, height: window.innerHeight },
      });
      const shownHeight = Math.min(popupHeight, placed.maxHeight);
      const isGrowingUp = placed.growth === 'up';

      setStyle({
        top: isGrowingUp ? undefined : placed.top,
        bottom: isGrowingUp ? window.innerHeight - placed.top - shownHeight : undefined,
        left: placed.left,
        maxWidth: shownMaxWidth,
        maxHeight: placed.maxHeight,
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
    isAnchorWrapper,
    isAtLeastTriggerWidth,
    maxWidth,
    open,
    popupRef,
    shouldMatchTriggerWidth,
    side,
    triggerRef,
    viewportMargin,
  ]);

  return style;
};
