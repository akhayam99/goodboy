import { useEffect, useRef, useState } from 'react';

const PIN_TOLERANCE_PX = 32;

export const useScrollPin = (deps: ReadonlyArray<unknown>, resetKey?: unknown) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    setPinned(true);
  }, [resetKey]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !pinned) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [pinned, ...deps]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distance < PIN_TOLERANCE_PX);
    setAtTop(el.scrollTop < PIN_TOLERANCE_PX);
  };

  return { scrollerRef, pinned, atTop, onScroll };
};
