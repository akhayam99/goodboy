import { useLayoutEffect, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { DROPDOWN_MAX_HEIGHT_VARIABLE } from './dropdownMaxHeight';

type Direction = 'up' | 'down';

type Strategy = 'absolute' | 'fixed';

type Align = 'start' | 'end' | 'center';

type Params = {
  readonly triggerRef: RefObject<HTMLElement | null>;
  readonly popupRef: RefObject<HTMLElement | null>;
  readonly open: boolean;
  readonly expectedHeight: number;
  readonly expectedWidth: number;
  readonly align: Align;
  readonly strategy: Strategy;
};

type Position = {
  readonly direction: Direction;
  readonly style?: CSSProperties;
};

type FindClippingAncestorParams = {
  readonly element: HTMLElement;
};

type ResolveDesiredLeftParams = {
  readonly rect: DOMRect;
  readonly popupWidth: number;
  readonly align: Align;
};

type ResolveBoundedMaxHeightParams = {
  readonly rect: DOMRect;
  readonly direction: Direction;
  readonly bottomBound: number;
  readonly topBound: number;
};

const VIEWPORT_MARGIN = 8;
const DROPDOWN_GAP = 4;
const MIN_DROPDOWN_HEIGHT = 160;

const resolveDesiredLeft = ({ rect, popupWidth, align }: ResolveDesiredLeftParams): number => {
  if (align === 'end') {
    return rect.right - popupWidth;
  }
  if (align === 'center') {
    return rect.left + rect.width / 2 - popupWidth / 2;
  }
  return rect.left;
};

const resolveBoundedMaxHeight = ({
  rect,
  direction,
  bottomBound,
  topBound,
}: ResolveBoundedMaxHeightParams): number => {
  const inset = DROPDOWN_GAP + VIEWPORT_MARGIN;
  const clipped =
    direction === 'down'
      ? Math.min(bottomBound, window.innerHeight) - rect.bottom
      : rect.top - Math.max(topBound, 0);
  const onScreen = direction === 'down' ? window.innerHeight - rect.bottom : rect.top;
  const wanted = Math.max(clipped - inset, MIN_DROPDOWN_HEIGHT);
  return Math.max(Math.min(wanted, onScreen - inset), 0);
};

const findClippingAncestor = ({ element }: FindClippingAncestorParams): HTMLElement | null => {
  let current = element.parentElement;
  while (current != null) {
    const style = getComputedStyle(current);
    const overflowY = style.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden') {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

export const useDropdownDirection = ({
  triggerRef,
  popupRef,
  open,
  expectedHeight,
  expectedWidth,
  align,
  strategy,
}: Params): Position => {
  const [position, setPosition] = useState<Position>({ direction: 'down' });

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
      if (strategy === 'absolute') {
        const clipper = findClippingAncestor({ element: trigger });
        const clipperRect = clipper?.getBoundingClientRect();
        const bottomBound = clipperRect?.bottom ?? window.innerHeight;
        const topBound = clipperRect?.top ?? 0;
        const spaceBelow = bottomBound - rect.bottom;
        const spaceAbove = rect.top - topBound;
        const direction = spaceBelow < expectedHeight && spaceAbove > spaceBelow ? 'up' : 'down';
        trigger.style.setProperty(
          DROPDOWN_MAX_HEIGHT_VARIABLE,
          `${resolveBoundedMaxHeight({ rect, direction, bottomBound, topBound })}px`,
        );
        setPosition({ direction });
        return;
      }

      const measuredWidth = popupRef.current?.getBoundingClientRect().width ?? 0;
      const viewportWidth = Math.max(window.innerWidth - VIEWPORT_MARGIN * 2, 0);
      const popupWidth = Math.min(measuredWidth > 0 ? measuredWidth : expectedWidth, viewportWidth);
      const desiredLeft = resolveDesiredLeft({ rect, popupWidth, align });
      const maxLeft = Math.max(window.innerWidth - popupWidth - VIEWPORT_MARGIN, VIEWPORT_MARGIN);
      const left = Math.min(Math.max(desiredLeft, VIEWPORT_MARGIN), maxLeft);
      const spaceBelow = Math.max(
        window.innerHeight - rect.bottom - DROPDOWN_GAP - VIEWPORT_MARGIN,
        0,
      );
      const spaceAbove = Math.max(rect.top - DROPDOWN_GAP - VIEWPORT_MARGIN, 0);
      const measuredHeight = popupRef.current?.getBoundingClientRect().height ?? 0;
      const popupHeight = measuredHeight > 0 ? measuredHeight : expectedHeight;
      const direction =
        spaceBelow >= MIN_DROPDOWN_HEIGHT || spaceBelow >= spaceAbove
          ? spaceBelow < popupHeight && spaceAbove > spaceBelow
            ? 'up'
            : 'down'
          : 'up';
      const availableHeight = direction === 'down' ? spaceBelow : spaceAbove;
      const maxHeight = Math.max(availableHeight, 0);

      setPosition({
        direction,
        style: {
          top: direction === 'down' ? rect.bottom + DROPDOWN_GAP : undefined,
          bottom: direction === 'up' ? window.innerHeight - rect.top + DROPDOWN_GAP : undefined,
          left,
          maxWidth: viewportWidth,
          maxHeight,
        },
      });
    };

    updatePosition();
    if (strategy === 'absolute') {
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('resize', updatePosition);
        triggerRef.current?.style.removeProperty(DROPDOWN_MAX_HEIGHT_VARIABLE);
      };
    }
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
  }, [align, expectedHeight, expectedWidth, open, popupRef, strategy, triggerRef]);

  return position;
};
