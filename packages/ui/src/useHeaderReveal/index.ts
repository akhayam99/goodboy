import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { HeaderReveal } from './headerRevealContext';
import { revealEngine } from './revealEngine';

type Params = {
  readonly regionRef: RefObject<HTMLElement | null>;
  readonly headerRef: RefObject<HTMLElement | null>;
  readonly bodyRef: RefObject<HTMLElement | null>;
  readonly resetKey: string | null;
  readonly hasLanes?: boolean;
};

export const useHeaderReveal = ({
  regionRef,
  headerRef,
  bodyRef,
  resetKey,
  hasLanes = false,
}: Params): HeaderReveal => {
  const [engine] = useState(() => revealEngine({ regionRef, headerRef, bodyRef, hasLanes }));
  const seenKeyRef = useRef(resetKey);

  useLayoutEffect(() => engine.attach(), [engine]);

  useLayoutEffect(() => {
    if (resetKey === seenKeyRef.current) {
      return;
    }
    seenKeyRef.current = resetKey;
    engine.reveal.holdAppScroll();
    engine.reset();
  }, [engine, resetKey]);

  return engine.reveal;
};
