import { useCallback, useEffect, useRef, useState } from 'react';

const PIN_TOLERANCE_PX = 32;
const SETTLE_FRAMES = 30;
const STABLE_FRAMES = 3;
const OWN_SCROLL_TOLERANCE_PX = 2;
const ANSWER_TOP_GAP_PX = 56;
const ANSWER_SELECTOR = '[data-reveal-answer]';
const CONTENT_SELECTOR = '[data-scroll-content]';

export const USER_SCROLL_EVENTS = ['wheel', 'touchmove', 'pointerdown', 'keydown'] as const;

type OverflowParams = {
  readonly keys: ReadonlyArray<string>;
};

type Params = {
  readonly deps: ReadonlyArray<unknown>;
  readonly resetKey?: unknown;
  readonly onRevealOverflow?: (params: OverflowParams) => void;
};

type AnswerTopParams = {
  readonly scroller: HTMLElement;
  readonly answer: HTMLElement;
};

const answerTopOf = ({ scroller, answer }: AnswerTopParams): number =>
  answer.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;

type OverflowKeysParams = {
  readonly scroller: HTMLElement;
  readonly answers: ReadonlyArray<HTMLElement>;
};

const overflowKeysOf = ({ scroller, answers }: OverflowKeysParams): ReadonlyArray<string> => {
  const viewportBottom = scroller.getBoundingClientRect().bottom;
  return answers
    .filter((answer) => answer.getBoundingClientRect().bottom > viewportBottom)
    .map((answer) => answer.dataset['revealAnswer'] ?? '')
    .filter((key) => key !== '');
};

export const useScrollPin = ({ deps, resetKey, onRevealOverflow }: Params) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const settleFrame = useRef<number | null>(null);
  const [pinned, setPinned] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const pinnedRef = useRef(true);
  const isAnchoredRef = useRef(false);
  const isLockedRef = useRef(false);
  const ownTopRef = useRef<number | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const observedRef = useRef<Element | null>(null);
  const overflowRef = useRef(onRevealOverflow);
  pinnedRef.current = pinned;
  overflowRef.current = onRevealOverflow;

  const stopSettling = useCallback(() => {
    if (settleFrame.current !== null) {
      cancelAnimationFrame(settleFrame.current);
      settleFrame.current = null;
    }
  }, []);

  const applyFollow = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || (!pinnedRef.current && !isAnchoredRef.current)) {
      return;
    }
    const answers = [...el.querySelectorAll<HTMLElement>(ANSWER_SELECTOR)];
    const answer = answers[answers.length - 1];
    if (answer === undefined) {
      isLockedRef.current = false;
      if (isAnchoredRef.current) {
        isAnchoredRef.current = false;
        return;
      }
      el.scrollTop = el.scrollHeight;
      ownTopRef.current = el.scrollTop;
      return;
    }
    if (isLockedRef.current) {
      el.scrollTop = el.scrollHeight;
      ownTopRef.current = el.scrollTop;
      return;
    }
    const bottom = Math.max(0, el.scrollHeight - el.clientHeight);
    const anchorTop = Math.max(0, answerTopOf({ scroller: el, answer }) - ANSWER_TOP_GAP_PX);
    isAnchoredRef.current = anchorTop < bottom;
    el.scrollTop = Math.min(bottom, anchorTop);
    ownTopRef.current = el.scrollTop;
    if (!isAnchoredRef.current) {
      return;
    }
    const keys = overflowKeysOf({ scroller: el, answers });
    if (keys.length > 0) {
      overflowRef.current?.({ keys });
    }
  }, []);

  useEffect(() => {
    setPinned(true);
    isAnchoredRef.current = false;
    isLockedRef.current = false;
    ownTopRef.current = null;
  }, [resetKey]);

  const observeContent = useCallback(() => {
    const el = scrollerRef.current;
    if (!(el instanceof HTMLElement) || typeof ResizeObserver === 'undefined') {
      return;
    }
    const content = el.querySelector(CONTENT_SELECTOR);
    if (content === null || content === observedRef.current) {
      return;
    }
    const observer = observerRef.current ?? new ResizeObserver(applyFollow);
    observer.disconnect();
    observer.observe(content);
    observerRef.current = observer;
    observedRef.current = content;
  }, [applyFollow]);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      observedRef.current = null;
    },
    [],
  );

  useEffect(() => {
    observeContent();
    const el = scrollerRef.current;
    if (!el || !pinned) {
      return;
    }
    applyFollow();
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
      applyFollow();
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
  }, [pinned, stopSettling, applyFollow, observeContent, ...deps]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtTop(el.scrollTop < PIN_TOLERANCE_PX);
    const ownTop = ownTopRef.current;
    const isOwn = ownTop !== null && Math.abs(el.scrollTop - ownTop) <= OWN_SCROLL_TOLERANCE_PX;
    if (isOwn) {
      if (isAnchoredRef.current) {
        setPinned(false);
        return;
      }
      if (distance < PIN_TOLERANCE_PX) {
        setPinned(true);
      }
      return;
    }
    isAnchoredRef.current = false;
    if (distance < PIN_TOLERANCE_PX) {
      isLockedRef.current = el.querySelector(ANSWER_SELECTOR) !== null;
      setPinned(true);
      return;
    }
    if (settleFrame.current !== null) {
      return;
    }
    setPinned(false);
  };

  const jumpToLatest = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    isAnchoredRef.current = false;
    isLockedRef.current = true;
    ownTopRef.current = null;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  const isHolding = useCallback(() => pinnedRef.current || isAnchoredRef.current, []);

  return {
    scrollerRef,
    pinned,
    atTop,
    onScroll,
    onUserScroll: stopSettling,
    jumpToLatest,
    isHolding,
  };
};
