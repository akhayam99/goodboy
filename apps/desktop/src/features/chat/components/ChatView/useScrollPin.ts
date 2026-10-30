import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const PIN_TOLERANCE_PX = 32;
const SETTLE_FRAMES = 30;
const STABLE_FRAMES = 3;
const OWN_SCROLL_TOLERANCE_PX = 2;
const ANSWER_TOP_GAP_PX = 56;
const ANCHOR_TOP_PX = 40;
export const TRANSCRIPT_FLOOR_PX = 48;
const ANSWER_SELECTOR = '[data-reveal-answer]';
const CONTENT_SELECTOR = '[data-scroll-content]';
const TURN_SELECTOR = '[data-turn]';

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
  readonly anchorKey?: string | null | undefined;
  readonly onRevealOverflow?: (params: OverflowParams) => void;
};

type AnswerTopParams = {
  readonly scroller: HTMLElement;
  readonly answer: HTMLElement;
};

const answerTopOf = ({ scroller, answer }: AnswerTopParams): number =>
  answer.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;

type TurnFitParams = {
  readonly scroller: HTMLElement;
  readonly turn: HTMLElement;
};

const turnTopOf = ({ scroller, turn }: TurnFitParams): number =>
  turn.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;

const spacerOf = ({ scroller, turn }: TurnFitParams): number =>
  Math.max(
    0,
    scroller.clientHeight -
      ANCHOR_TOP_PX -
      turn.getBoundingClientRect().height -
      TRANSCRIPT_FLOOR_PX,
  );

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

export const useScrollPin = ({ deps, resetKey, anchorKey, onRevealOverflow }: Params) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);
  const settleFrame = useRef<number | null>(null);
  const [pinned, setPinned] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const [isBehind, setIsBehind] = useState(false);
  const pinnedRef = useRef(true);
  const isAnchoredRef = useRef(false);
  const isTurnAnchorRef = useRef(false);
  const isSpacerOnRef = useRef(false);
  const spacerPxRef = useRef(0);
  const seenAnchorRef = useRef<string | null | undefined>(undefined);
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

  const clearAnchor = useCallback(() => {
    isAnchoredRef.current = false;
    isTurnAnchorRef.current = false;
  }, []);

  const lastTurnOf = useCallback((): HTMLElement | null => {
    const turns = scrollerRef.current?.querySelectorAll<HTMLElement>(TURN_SELECTOR);
    return turns === undefined || turns.length === 0 ? null : (turns[turns.length - 1] ?? null);
  }, []);

  const fitTail = useCallback(() => {
    const el = scrollerRef.current;
    const tail = tailRef.current;
    const turn = lastTurnOf();
    const spacer =
      el !== null && turn !== null && isSpacerOnRef.current ? spacerOf({ scroller: el, turn }) : 0;
    spacerPxRef.current = spacer;
    if (tail !== null) {
      tail.style.height = `${TRANSCRIPT_FLOOR_PX + spacer}px`;
    }
  }, [lastTurnOf]);

  const measureBehind = useCallback(() => {
    const el = scrollerRef.current;
    if (el === null) {
      return;
    }
    const distance =
      el.scrollHeight - spacerPxRef.current - clampedTopOf({ scroller: el }) - el.clientHeight;
    setIsBehind(distance >= PIN_TOLERANCE_PX);
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
    const turn = isTurnAnchorRef.current ? lastTurnOf() : null;
    if (turn !== null) {
      const turnBottom = Math.max(0, el.scrollHeight - el.clientHeight);
      const turnTop = Math.max(0, turnTopOf({ scroller: el, turn }) - ANCHOR_TOP_PX);
      el.scrollTop = Math.min(turnBottom, turnTop);
      ownTopRef.current = el.scrollTop;
      const turnKeys = overflowKeysOf({ scroller: el, answers });
      if (turnKeys.length > 0) {
        overflowRef.current?.({ keys: turnKeys });
      }
      return;
    }
    const answer = answers[answers.length - 1];
    if (answer === undefined) {
      isLockedRef.current = false;
      if (isAnchoredRef.current) {
        clearAnchor();
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
    isTurnAnchorRef.current = false;
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
  }, [clearAnchor, lastTurnOf]);

  useEffect(() => {
    writePinned({ isPinned: true });
    clearAnchor();
    isLockedRef.current = false;
    ownTopRef.current = null;
    isSpacerOnRef.current = false;
    seenAnchorRef.current = undefined;
    fitTail();
  }, [resetKey, writePinned, clearAnchor, fitTail]);

  useEffect(() => {
    if (anchorKey === undefined) {
      return;
    }
    const seen = seenAnchorRef.current;
    seenAnchorRef.current = anchorKey;
    if (seen === undefined || anchorKey === null || anchorKey === seen) {
      return;
    }
    isSpacerOnRef.current = true;
    isTurnAnchorRef.current = true;
    isAnchoredRef.current = true;
    isLockedRef.current = false;
    pinnedRef.current = false;
    setPinned(false);
    fitTail();
    applyFollow();
    measureBehind();
  }, [anchorKey, resetKey, fitTail, applyFollow, measureBehind]);

  const onContentResize = useCallback(() => {
    fitTail();
    applyFollow();
    measureBehind();
  }, [fitTail, applyFollow, measureBehind]);

  const observeContent = useCallback(() => {
    const el = scrollerRef.current;
    if (!(el instanceof HTMLElement) || typeof ResizeObserver === 'undefined') {
      return;
    }
    const content = el.querySelector(CONTENT_SELECTOR);
    if (content === null || content === observedRef.current) {
      return;
    }
    const observer = observerRef.current ?? new ResizeObserver(onContentResize);
    observer.disconnect();
    observer.observe(content);
    observer.observe(el);
    observerRef.current = observer;
    observedRef.current = content;
  }, [onContentResize]);

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
      clearAnchor();
      writePinned({ isPinned: false });
      return;
    }
    applyFollow();
  }, [writePinned, applyFollow, clearAnchor]);

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
    clearAnchor();
    isLockedRef.current = false;
    writePinned({ isPinned: false });
  }, [stopSettling, writePinned, clearAnchor]);

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
    measureBehind();
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
      clearAnchor();
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
    clearAnchor();
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
    clearAnchor();
    isLockedRef.current = true;
    ownTopRef.current = null;
    isSpacerOnRef.current = false;
    fitTail();
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [clearAnchor, fitTail]);

  const isHolding = useCallback(() => pinnedRef.current || isAnchoredRef.current, []);

  return {
    scrollerRef,
    tailRef,
    pinned,
    isBehind,
    atTop,
    onScroll,
    onUserScroll,
    onPointerDown,
    userInput,
    jumpToLatest,
    isHolding,
  };
};
