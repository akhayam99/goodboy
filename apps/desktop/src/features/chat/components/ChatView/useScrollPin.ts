import { useCallback, useEffect, useRef, useState } from 'react';

const PIN_TOLERANCE_PX = 32;
const SETTLE_FRAMES = 30;
const STABLE_FRAMES = 3;

export const USER_SCROLL_EVENTS = ['wheel', 'touchmove', 'pointerdown', 'keydown'] as const;

type Params = {
  readonly deps: ReadonlyArray<unknown>;
  readonly resetKey?: unknown;
};

export const useScrollPin = ({ deps, resetKey }: Params) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const settleFrame = useRef<number | null>(null);
  const [pinned, setPinned] = useState(true);
  const [atTop, setAtTop] = useState(true);

  const stopSettling = useCallback(() => {
    if (settleFrame.current !== null) {
      cancelAnimationFrame(settleFrame.current);
      settleFrame.current = null;
    }
  }, []);

  useEffect(() => {
    setPinned(true);
  }, [resetKey]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !pinned) {
      return;
    }
    el.scrollTop = el.scrollHeight;
    let last = el.scrollHeight;
    let frames = 0;
    let stable = 0;
    const tick = () => {
      const current = scrollerRef.current;
      if (!current) {
        settleFrame.current = null;
        return;
      }
      stable = current.scrollHeight === last ? stable + 1 : 0;
      last = current.scrollHeight;
      current.scrollTop = current.scrollHeight;
      frames += 1;
      if (stable >= STABLE_FRAMES || frames >= SETTLE_FRAMES) {
        settleFrame.current = null;
        return;
      }
      settleFrame.current = requestAnimationFrame(tick);
    };
    stopSettling();
    settleFrame.current = requestAnimationFrame(tick);
    return stopSettling;
  }, [pinned, stopSettling, ...deps]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtTop(el.scrollTop < PIN_TOLERANCE_PX);
    if (distance < PIN_TOLERANCE_PX) {
      setPinned(true);
      return;
    }
    if (settleFrame.current !== null) {
      return;
    }
    setPinned(false);
  };

  return { scrollerRef, pinned, atTop, onScroll, onUserScroll: stopSettling };
};
