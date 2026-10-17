import { useLayoutEffect, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';

type Direction = 'up' | 'down';

export type DropdownSide = 'bottom' | 'right';

export type DropdownAlign = 'start' | 'end' | 'center';

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

type ResolveDesiredLeftParams = {
  readonly rect: DOMRect;
  readonly popupWidth: number;
  readonly align: DropdownAlign;
};

type AnchorRectParams = {
  readonly trigger: HTMLElement;
  readonly isAnchorWrapper: boolean;
};

type PlaceOnRightParams = {
  readonly rect: DOMRect;
  readonly popupWidth: number;
  readonly popupHeight: number;
  readonly align: DropdownAlign;
  readonly viewportMargin: number;
};

type RightPlacement = {
  readonly left: number;
  readonly top: number;
  readonly maxHeight: number;
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

const resolveDesiredLeft = ({ rect, popupWidth, align }: ResolveDesiredLeftParams): number => {
  if (align === 'end') {
    return rect.right - popupWidth;
  }
  if (align === 'center') {
    return rect.left + rect.width / 2 - popupWidth / 2;
  }
  return rect.left;
};

const placeOnRight = ({
  rect,
  popupWidth,
  popupHeight,
  align,
  viewportMargin,
}: PlaceOnRightParams): RightPlacement => {
  const bottomLimit = Math.max(
    window.innerHeight - viewportMargin - readBottomInset(),
    Math.min(rect.bottom, window.innerHeight - viewportMargin),
  );
  const maxHeight = Math.max(bottomLimit - viewportMargin, 0);
  const shownHeight = Math.min(popupHeight, maxHeight);
  const desiredTop =
    align === 'end'
      ? rect.bottom - shownHeight
      : align === 'center'
        ? rect.top + rect.height / 2 - shownHeight / 2
        : rect.top;
  const top = Math.min(Math.max(desiredTop, viewportMargin), bottomLimit - shownHeight);
  const roomRight = window.innerWidth - viewportMargin - rect.right - SIDE_GAP;
  const roomLeft = rect.left - SIDE_GAP - viewportMargin;
  const desiredLeft =
    roomRight >= popupWidth || roomRight >= roomLeft
      ? rect.right + SIDE_GAP
      : rect.left - SIDE_GAP - popupWidth;
  const maxLeft = Math.max(window.innerWidth - popupWidth - viewportMargin, viewportMargin);
  return {
    left: Math.min(Math.max(desiredLeft, viewportMargin), maxLeft),
    top,
    maxHeight,
  };
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
      const widthStyle: CSSProperties = {
        ...(shouldMatchTriggerWidth ? { width: popupWidth } : {}),
        ...(isAtLeastTriggerWidth ? { minWidth: Math.min(rect.width, viewportWidth) } : {}),
      };

      if (side === 'right') {
        const placed = placeOnRight({ rect, popupWidth, popupHeight, align, viewportMargin });
        setStyle({ ...placed, maxWidth: shownMaxWidth, ...widthStyle });
        return;
      }

      const desiredLeft = resolveDesiredLeft({ rect, popupWidth, align });
      const maxLeft = Math.max(window.innerWidth - popupWidth - viewportMargin, viewportMargin);
      const left = Math.min(Math.max(desiredLeft, viewportMargin), maxLeft);
      const spaceBelow = Math.max(
        window.innerHeight - rect.bottom - DROPDOWN_GAP - viewportMargin - readBottomInset(),
        0,
      );
      const spaceAbove = Math.max(rect.top - DROPDOWN_GAP - viewportMargin, 0);
      const direction: Direction =
        spaceBelow >= MIN_DROPDOWN_HEIGHT || spaceBelow >= spaceAbove
          ? spaceBelow < popupHeight && spaceAbove > spaceBelow
            ? 'up'
            : 'down'
          : 'up';
      const availableHeight = direction === 'down' ? spaceBelow : spaceAbove;

      setStyle({
        top: direction === 'down' ? rect.bottom + DROPDOWN_GAP : undefined,
        bottom: direction === 'up' ? window.innerHeight - rect.top + DROPDOWN_GAP : undefined,
        left,
        maxWidth: shownMaxWidth,
        maxHeight: Math.max(availableHeight, 0),
        ...widthStyle,
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
