import { useLayoutEffect, useState, type RefObject } from 'react';
import type { HeaderReveal } from './headerRevealContext';
import { revealEngine } from './revealEngine';

type Params = {
  readonly regionRef: RefObject<HTMLElement | null>;
  readonly headerRef: RefObject<HTMLElement | null>;
  readonly bodyRef: RefObject<HTMLElement | null>;
};

export const useHeaderReveal = ({ regionRef, headerRef, bodyRef }: Params): HeaderReveal => {
  const [engine] = useState(() => revealEngine({ regionRef, headerRef, bodyRef }));

  useLayoutEffect(() => engine.attach(), [engine]);

  return engine.reveal;
};
