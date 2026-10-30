import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const PIN_TOLERANCE_PX = 32;
const SETTLE_FRAMES = 30;
const STABLE_FRAMES = 3;
const OWN_SCROLL_TOLERANCE_PX = 2;
const ANSWER_TOP_GAP_PX = 56;
const ANSWER_SELECTOR = '[data-reveal-answer]';
const CONTENT_SELECTOR = '[data-scroll-content]';

const GESTURE_IDLE_MS = 160;
const CLAMP_DISTANCE_PX = 0.5;
const POINTER_END_EVENTS = ['pointerup', 'pointercancel'] as const;
const NON_SCROLL_TARGET_SELECTOR = 'button, a, input, textarea, select';

export const USER_SCROLL_EVENTS = ['wheel', 'touchmove', 'keydown'] as const;

export const RELEASE_FOLLOW_EVENT = 'goodboy:release-follow';

type PointerDownParams = {
  readonly target: EventTarget | null;
};

type OverflowParams = {
  readonly keys: ReadonlyArray<string>;
};

type WritePinnedParams = {
  readonly isPinned: boolean;
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

type ClampedTopParams = {
  readonly scroller: HTMLElement;
};

const clampedTopOf = ({ scroller }: ClampedTopParams): number =>
  Math.min(
    Math.max(0, scroller.scrollHeight - scroller.clientHeight),
    Math.max(0, scroller.scrollTop),
  );

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
  const lastTopRef = useRef<number | null>(null);
  const lastHeightRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const observedRef = useRef<Element | null>(null);
  const overflowRef = useRef(onRevealOverflow);
  pinnedRef.current = pinned;
  overflowRef.current = onRevealOverflow;

  const writePinned = useCallback(({ isPinned }: WritePinnedParams) => {
    pinnedRef.current = isPinned;
    setPinned(isPinned);
  }, []);

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
    if (isDraggingRef.current || holdTimerRef.current !== null) {
      return;
    }
    lastTopRef.current = null;
    lastHeightRef.current = el.scrollHeight;
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
    writePinned({ isPinned: true });
    isAnchoredRef.current = false;
    isLockedRef.current = false;
    ownTopRef.current = null;
  }, [resetKey, writePinned]);

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

  const releaseGesture = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    isDraggingRef.current = false;
    for (const name of POINTER_END_EVENTS) {
      window.removeEventListener(name, releaseGesture);
    }
    const el = scrollerRef.current;
    if (el === null) {
      return;
    }
    const lastTop = lastTopRef.current ?? ownTopRef.current;
    const lastHeight = lastHeightRef.current;
    const top = clampedTopOf({ scroller: el });
    const isClamp =
      lastHeight !== null &&
      el.scrollHeight < lastHeight &&
      el.scrollHeight - top - el.clientHeight <= CLAMP_DISTANCE_PX;
    lastTopRef.current = top;
    if (lastTop !== null && top < lastTop && !isClamp) {
      isAnchoredRef.current = false;
      writePinned({ isPinned: false });
      return;
    }
    applyFollow();
  }, [writePinned, applyFollow]);

  const armHoldTimer = useCallback(() => {
    if (isDraggingRef.current) {
      return;
    }
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
    }
    holdTimerRef.current = setTimeout(releaseGesture, GESTURE_IDLE_MS);
  }, [releaseGesture]);

  const onUserScroll = useCallback(() => {
    stopSettling();
    armHoldTimer();
  }, [stopSettling, armHoldTimer]);

  const onPointerDown = useCallback(
    ({ target }: PointerDownParams) => {
      const el = scrollerRef.current;
      if (el === null || !(target instanceof Element)) {
        return;
      }
      const isScrollbar = target === el || !el.contains(target);
      if (!isScrollbar || target.closest(NON_SCROLL_TARGET_SELECTOR) !== null) {
        return;
      }
      stopSettling();
      if (holdTimerRef.current !== null) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      isDraggingRef.current = true;
      for (const name of POINTER_END_EVENTS) {
        window.addEventListener(name, releaseGesture);
      }
    },
    [stopSettling, releaseGesture],
  );

  const releaseFollow = useCallback(() => {
    stopSettling();
    isAnchoredRef.current = false;
    isLockedRef.current = false;
    writePinned({ isPinned: false });
  }, [stopSettling, writePinned]);

  const userInput = useMemo(
    () => ({ onInput: onUserScroll, onPointerDown, onRelease: releaseFollow }),
    [onUserScroll, onPointerDown, releaseFollow],
  );

  useEffect(
    () => () => {
      if (holdTimerRef.current !== null) {
        clearTimeout(holdTimerRef.current);
      }
      for (const name of POINTER_END_EVENTS) {
        window.removeEventListener(name, releaseGesture);
      }
    },
    [releaseGesture],
  );

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const top = clampedTopOf({ scroller: el });
    const distance = el.scrollHeight - top - el.clientHeight;
    setAtTop(top < PIN_TOLERANCE_PX);
    const lastTop = lastTopRef.current ?? ownTopRef.current;
    lastTopRef.current = top;
    const lastHeight = lastHeightRef.current;
    lastHeightRef.current = el.scrollHeight;
    const isUserInput = isDraggingRef.current || holdTimerRef.current !== null;
    if (holdTimerRef.current !== null) {
      armHoldTimer();
    }
    const isClamp =
      lastHeight !== null && el.scrollHeight < lastHeight && distance <= CLAMP_DISTANCE_PX;
    const isUserMove = isUserInput && !isClamp && lastTop !== null && top !== lastTop;
    if (isUserMove && isAnchoredRef.current) {
      isAnchoredRef.current = false;
      writePinned({ isPinned: distance < PIN_TOLERANCE_PX });
    }
    const isUp = lastTop !== null && top < lastTop && !isClamp;
    if (isUserMove && isUp) {
      stopSettling();
      writePinned({ isPinned: false });
      return;
    }
    const ownTop = ownTopRef.current;
    const isOwn = ownTop !== null && Math.abs(top - ownTop) <= OWN_SCROLL_TOLERANCE_PX;
    if (isOwn) {
      if (isAnchoredRef.current) {
        writePinned({ isPinned: false });
        return;
      }
      if (distance < PIN_TOLERANCE_PX) {
        writePinned({ isPinned: true });
      }
      return;
    }
    isAnchoredRef.current = false;
    if (distance < PIN_TOLERANCE_PX) {
      isLockedRef.current = el.querySelector(ANSWER_SELECTOR) !== null;
      writePinned({ isPinned: true });
      return;
    }
    if (isUp && settleFrame.current === null) {
      writePinned({ isPinned: false });
    }
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
    onUserScroll,
    onPointerDown,
    userInput,
    jumpToLatest,
    isHolding,
  };
};
