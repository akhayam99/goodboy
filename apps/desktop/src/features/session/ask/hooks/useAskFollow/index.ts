import { useEffect, useRef, type RefObject } from 'react';

type Params = {
  readonly endRef: RefObject<HTMLElement | null>;
  readonly isActive: boolean;
  readonly contentLength: number;
  readonly turnCount: number;
};

type ScrollParams = {
  readonly target: EventTarget | null;
};

const PIN_SLACK_PX = 48;

export const useAskFollow = ({ endRef, isActive, contentLength, turnCount }: Params): void => {
  const isPinnedRef = useRef(true);
  const lastTopRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    const onScroll = ({ target }: ScrollParams) => {
      const scroller = target;
      if (!(scroller instanceof HTMLElement) || !scroller.contains(endRef.current)) {
        return;
      }
      const top = scroller.scrollTop;
      const isAtEnd = scroller.scrollHeight - top - scroller.clientHeight <= PIN_SLACK_PX;
      isPinnedRef.current = isAtEnd && top >= lastTopRef.current;
      lastTopRef.current = top;
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [endRef, isActive]);

  useEffect(() => {
    isPinnedRef.current = true;
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [endRef, turnCount]);

  useEffect(() => {
    if (!isPinnedRef.current) {
      return;
    }
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [endRef, contentLength]);
};
