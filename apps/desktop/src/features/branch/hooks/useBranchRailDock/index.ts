import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { STUDIO_RAIL_MIN, useEscapeLayer } from '@goodboy/ui';

export const BRANCH_DETAIL_MIN_PX = 560;

export const BRANCH_DOCK_MIN_PX = BRANCH_DETAIL_MIN_PX + STUDIO_RAIL_MIN;

export type BranchRailDock = {
  readonly paneRef: RefObject<HTMLDivElement | null>;
  readonly isDocked: boolean;
  readonly isOverlayOpen: boolean;
  readonly openOverlay: () => void;
  readonly closeOverlay: () => void;
};

export const useBranchRailDock = (): BranchRailDock => {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [paneWidth, setPaneWidth] = useState<number | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const isDocked = paneWidth === null || paneWidth >= BRANCH_DOCK_MIN_PX;

  useLayoutEffect(() => {
    const element = paneRef.current;
    if (element === null) {
      return;
    }
    const apply = (width: number): void => setPaneWidth(width > 0 ? width : null);
    apply(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) {
        apply(entry.contentRect.width);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isDocked) {
      setIsOverlayOpen(false);
    }
  }, [isDocked]);

  const openOverlay = useCallback(() => {
    if (!isDocked) {
      setIsOverlayOpen(true);
    }
  }, [isDocked]);
  const closeOverlay = useCallback(() => setIsOverlayOpen(false), []);

  useEscapeLayer(closeOverlay, isOverlayOpen);

  return { paneRef, isDocked, isOverlayOpen, openOverlay, closeOverlay };
};
