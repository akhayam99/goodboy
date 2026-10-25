import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import {
  placeFloating,
  type FloatingAlign,
  type FloatingCoords,
  type FloatingRect,
  type FloatingSide,
} from '../placeFloating';

type Params = {
  readonly anchor: HTMLElement | null;
  readonly tipRef: RefObject<HTMLElement | null>;
  readonly isActive: boolean;
  readonly side: FloatingSide;
  readonly gap: number;
  readonly edge: number;
  readonly alignment?: FloatingAlign;
  readonly clearOf?: HTMLElement | null;
  readonly contentKey?: string | number;
};

type SameParams = {
  readonly left: FloatingCoords | null;
  readonly right: FloatingCoords | null;
};

type ScrollParams = Pick<Event, 'target'>;

type AnchorRectParams = {
  readonly anchor: HTMLElement;
  readonly clearOf: HTMLElement | null;
};

const isSamePlace = ({ left, right }: SameParams): boolean => {
  if (left === null || right === null) {
    return left === right;
  }
  return left.top === right.top && left.left === right.left && left.side === right.side;
};

const anchorRectOf = ({ anchor, clearOf }: AnchorRectParams): FloatingRect => {
  const own = anchor.getBoundingClientRect();
  if (clearOf === null) {
    return own;
  }
  const right = clearOf.getBoundingClientRect().right;
  return {
    top: own.top,
    bottom: own.bottom,
    left: own.left,
    height: own.height,
    right,
    width: right - own.left,
  };
};

export const useFloatingPlace = ({
  anchor,
  tipRef,
  isActive,
  side,
  gap,
  edge,
  alignment = 'center',
  clearOf = null,
  contentKey,
}: Params): FloatingCoords | null => {
  const [place, setPlace] = useState<FloatingCoords | null>(null);

  const measure = useCallback((): FloatingCoords | null => {
    const tip = tipRef.current;
    if (!isActive || anchor === null || tip === null) {
      return null;
    }
    return placeFloating({
      anchor: anchorRectOf({ anchor, clearOf }),
      tip: tip.getBoundingClientRect(),
      side,
      gap,
      edge,
      alignment,
    });
  }, [anchor, tipRef, isActive, clearOf, side, gap, edge, alignment]);

  const remeasure = useCallback(() => {
    const next = measure();
    setPlace((previous) => (isSamePlace({ left: previous, right: next }) ? previous : next));
  }, [measure]);

  useLayoutEffect(() => {
    remeasure();
  }, [remeasure, contentKey]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    const onScroll = ({ target }: ScrollParams) => {
      const tip = tipRef.current;
      if (tip !== null && target instanceof Node && tip.contains(target)) {
        return;
      }
      remeasure();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', remeasure);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', remeasure);
    };
  }, [isActive, tipRef, remeasure]);

  return place;
};
