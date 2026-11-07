import { createContext } from 'react';

export type PageScroller = {
  readonly root: HTMLElement;
  readonly viewport: HTMLElement;
};

export type HeaderReveal = {
  readonly register: (scroller: PageScroller) => () => void;
};

export const HeaderRevealContext = createContext<HeaderReveal | null>(null);
