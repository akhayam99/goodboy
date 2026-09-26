import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { thumbGeometry, TRACK_INSET } from './geometry';

const HIDE_DELAY_MS = 900;

type Orientation = 'vertical' | 'horizontal';

type Params = {
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  readonly orientation: Orientation;
  readonly alwaysVisible: boolean;
};

type Result = {
  readonly thumbRef: RefObject<HTMLDivElement | null>;
  readonly hasOverflow: boolean;
  readonly visible: boolean;
  readonly active: boolean;
  readonly onThumbPointerEnter: () => void;
  readonly onThumbPointerLeave: () => void;
  readonly onThumbPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onTrackPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

type DragOrigin = {
  readonly pointerStart: number;
  readonly scrollStart: number;
};

export const useOverlayThumb = ({ viewportRef, orientation, alwaysVisible }: Params): Result => {
  const thumbRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const dragOrigin = useRef<DragOrigin | null>(null);
  const horizontal = orientation === 'horizontal';

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = window.setTimeout(() => setVisible(false), HIDE_DELAY_MS);
  }, [clearHideTimer]);

  const reveal = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const layout = useCallback(() => {
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    const scrollSize = horizontal ? viewport.scrollWidth : viewport.scrollHeight;
    const clientSize = horizontal ? viewport.clientWidth : viewport.clientHeight;
    const scrollPos = horizontal ? viewport.scrollLeft : viewport.scrollTop;
    const geometry = thumbGeometry({ scrollSize, clientSize, scrollPos });
    setHasOverflow(geometry.hasOverflow);
    const thumb = thumbRef.current;
    if (!geometry.hasOverflow || thumb === null) {
      return;
    }
    thumb.style.setProperty(horizontal ? 'width' : 'height', `${geometry.length}px`);
    thumb.style.transform = horizontal
      ? `translateX(${geometry.offset}px)`
      : `translateY(${geometry.offset}px)`;
  }, [horizontal, viewportRef]);

  useEffect(() => {
    if (hasOverflow) {
      layout();
    }
  }, [hasOverflow, layout]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    let frame = 0;
    const relayout = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    };
    const onScroll = () => {
      reveal();
      relayout();
    };
    layout();
    viewport.addEventListener('scroll', onScroll, { passive: true });
    const resize = new ResizeObserver(relayout);
    resize.observe(viewport);
    const mutate = new MutationObserver(relayout);
    mutate.observe(viewport, { childList: true, subtree: true });
    return () => {
      viewport.removeEventListener('scroll', onScroll);
      resize.disconnect();
      mutate.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [layout, reveal, viewportRef]);

  useEffect(() => clearHideTimer, [clearHideTimer]);

  const onThumbPointerEnter = () => {
    setHovered(true);
    clearHideTimer();
    setVisible(true);
  };

  const onThumbPointerLeave = () => {
    setHovered(false);
    if (!dragging) {
      scheduleHide();
    }
  };

  const onThumbPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    clearHideTimer();
    dragOrigin.current = {
      pointerStart: horizontal ? event.clientX : event.clientY,
      scrollStart: horizontal ? viewport.scrollLeft : viewport.scrollTop,
    };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) {
      return;
    }
    const viewport = viewportRef.current;
    const thumb = thumbRef.current;
    const onMove = (event: PointerEvent) => {
      if (viewport === null || thumb === null || dragOrigin.current === null) {
        return;
      }
      const scrollSize = horizontal ? viewport.scrollWidth : viewport.scrollHeight;
      const clientSize = horizontal ? viewport.clientWidth : viewport.clientHeight;
      const trackLength = clientSize - TRACK_INSET;
      const rect = thumb.getBoundingClientRect();
      const thumbLength = horizontal ? rect.width : rect.height;
      const maxThumbOffset = trackLength - thumbLength;
      const maxScroll = scrollSize - clientSize;
      const pointerNow = horizontal ? event.clientX : event.clientY;
      const delta = pointerNow - dragOrigin.current.pointerStart;
      const scrollDelta = maxThumbOffset <= 0 ? 0 : (delta / maxThumbOffset) * maxScroll;
      const next = Math.min(maxScroll, Math.max(0, dragOrigin.current.scrollStart + scrollDelta));
      const axis = horizontal ? 'scrollLeft' : 'scrollTop';
      viewport[axis] = next;
    };
    const onUp = () => {
      setDragging(false);
      dragOrigin.current = null;
      if (!hovered) {
        scheduleHide();
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, hovered, horizontal, scheduleHide, viewportRef]);

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (viewport === null || event.target !== event.currentTarget) {
      return;
    }
    const clientSize = horizontal ? viewport.clientWidth : viewport.clientHeight;
    const rect = event.currentTarget.getBoundingClientRect();
    const thumbRect = thumbRef.current?.getBoundingClientRect();
    const thumbStart = horizontal ? (thumbRect?.left ?? rect.left) : (thumbRect?.top ?? rect.top);
    const pointerPos = horizontal ? event.clientX : event.clientY;
    const direction = pointerPos < thumbStart ? -1 : 1;
    viewport.scrollBy(
      horizontal
        ? { left: direction * clientSize, behavior: 'smooth' }
        : { top: direction * clientSize, behavior: 'smooth' },
    );
    reveal();
  };

  return {
    thumbRef,
    hasOverflow,
    visible: alwaysVisible || visible || dragging,
    active: hovered || dragging,
    onThumbPointerEnter,
    onThumbPointerLeave,
    onThumbPointerDown,
    onTrackPointerDown,
  };
};
