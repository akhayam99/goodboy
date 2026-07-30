import { useLayoutEffect, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';

type Direction = 'up' | 'down';

type Strategy = 'absolute' | 'fixed';

type Params = {
  readonly triggerRef: RefObject<HTMLElement | null>;
  readonly popupRef: RefObject<HTMLElement | null>;
  readonly open: boolean;
  readonly expectedHeight: number;
  readonly expectedWidth: number;
  readonly align: 'start' | 'end';
  readonly strategy: Strategy;
};

type Position = {
  readonly direction: Direction;
  readonly style?: CSSProperties;
};

type FindClippingAncestorParams = {
  readonly element: HTMLElement;
};

const VIEWPORT_MARGIN = 8;
const DROPDOWN_GAP = 4;

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
        setPosition({
          direction: spaceBelow < expectedHeight && spaceAbove > spaceBelow ? 'up' : 'down',
        });
        return;
      }

      const measuredWidth = popupRef.current?.getBoundingClientRect().width ?? 0;
      const viewportWidth = Math.max(window.innerWidth - VIEWPORT_MARGIN * 2, 0);
      const popupWidth = Math.min(measuredWidth > 0 ? measuredWidth : expectedWidth, viewportWidth);
      const desiredLeft = align === 'end' ? rect.right - popupWidth : rect.left;
      const maxLeft = Math.max(window.innerWidth - popupWidth - VIEWPORT_MARGIN, VIEWPORT_MARGIN);
      const left = Math.min(Math.max(desiredLeft, VIEWPORT_MARGIN), maxLeft);
      const spaceBelow = window.innerHeight - rect.bottom;
      const direction = spaceBelow < expectedHeight + VIEWPORT_MARGIN ? 'up' : 'down';

      setPosition({
        direction,
        style: {
          top: direction === 'down' ? rect.bottom + DROPDOWN_GAP : undefined,
          bottom: direction === 'up' ? window.innerHeight - rect.top + DROPDOWN_GAP : undefined,
          left,
          maxWidth: viewportWidth,
        },
      });
    };

    updatePosition();
    if (strategy === 'absolute') {
      return;
    }
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, expectedHeight, expectedWidth, open, popupRef, strategy, triggerRef]);

  return position;
};
