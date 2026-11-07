import type { RefObject } from 'react';
import { isKeyboardFocus } from '../isKeyboardFocus';
import { DURATION_BASE_MS } from '../motionTimings';
import { prefersReducedMotion } from '../prefersReducedMotion';
import type { HeaderReveal, PageScroller } from './headerRevealContext';
import { headerRevealOf } from './headerRevealOf';
import type { HeaderRevealState } from './headerRevealState';
import { scrollIntent } from './scrollIntent';

type Params = {
  readonly regionRef: RefObject<HTMLElement | null>;
  readonly headerRef: RefObject<HTMLElement | null>;
  readonly bodyRef: RefObject<HTMLElement | null>;
};

export type RevealEngine = {
  readonly reveal: HeaderReveal;
  readonly attach: () => () => void;
  readonly reset: () => void;
};

type ViewportParams = {
  readonly viewport: HTMLElement;
};

type EvaluateParams = ViewportParams & {
  readonly isUserScroll: boolean;
};

type Drag = {
  readonly viewport: HTMLElement;
  readonly startTop: number;
};

type ExtendParams = {
  readonly region: HTMLElement;
  readonly shift: string;
  readonly isShown: boolean;
};

const clampedTopOf = ({ viewport }: ViewportParams): number =>
  Math.min(Math.max(0, viewport.scrollTop), rangeOf({ viewport }));

const rangeOf = ({ viewport }: ViewportParams): number =>
  Math.max(0, viewport.scrollHeight - viewport.clientHeight);

const NO_RELEASE = (): void => {};

export const revealEngine = ({ regionRef, headerRef, bodyRef }: Params): RevealEngine => {
  const intent = scrollIntent();
  let state: HeaderRevealState = { isShown: true, anchor: 0 };
  let claim: PageScroller | null = null;
  let lastTop = 0;
  let headerHeight = 0;
  let isSliding = false;
  let isFocusHeld = false;
  let isSettling = false;
  let settleGeneration = 0;
  let observer: ResizeObserver | null = null;
  let drag: Drag | null = null;
  let extendTimer: ReturnType<typeof setTimeout> | null = null;

  const paintExtend = ({ region, shift, isShown }: ExtendParams) => {
    if (extendTimer !== null) {
      clearTimeout(extendTimer);
      extendTimer = null;
    }
    if (!isShown || prefersReducedMotion()) {
      region.style.setProperty('--reveal-extend', shift);
      return;
    }
    extendTimer = setTimeout(() => {
      extendTimer = null;
      region.style.setProperty('--reveal-extend', '0px');
    }, DURATION_BASE_MS);
  };

  const paint = () => {
    const region = regionRef.current;
    if (region === null) {
      return;
    }
    const isShown = !isSliding || state.isShown;
    const shift = isShown ? '0px' : `${headerHeight}px`;
    region.setAttribute('data-reveal', isSliding ? 'slide' : 'static');
    region.setAttribute('data-reveal-header', isShown ? 'shown' : 'hidden');
    region.style.setProperty('--reveal-pad', `${headerHeight}px`);
    region.style.setProperty('--reveal-shift', shift);
    region.style.setProperty(
      '--reveal-duration',
      isShown ? 'var(--duration-base)' : 'var(--duration-quick)',
    );
    region.style.setProperty('--reveal-ease', isShown ? 'var(--ease-enter)' : 'var(--ease-exit)');
    paintExtend({ region, shift, isShown });
  };

  const liveViewport = (): HTMLElement | null => {
    const body = bodyRef.current;
    if (claim === null || body === null || !body.contains(claim.root)) {
      return null;
    }
    return claim.viewport;
  };

  const isLive = ({ viewport }: ViewportParams): boolean => liveViewport() === viewport;

  const forget = () => {
    settleGeneration += 1;
    isSettling = false;
    drag = null;
    intent.forget();
  };

  const evaluate = ({ viewport, isUserScroll }: EvaluateParams) => {
    const next = headerRevealOf({
      state,
      scrollTop: clampedTopOf({ viewport }),
      range: rangeOf({ viewport }),
      headerHeight,
      isUserScroll,
      isFocusHeld,
    });
    const isFlipped = next.isShown !== state.isShown;
    state = next;
    if (!isFlipped) {
      return;
    }
    paint();
    settle({ viewport });
  };

  const settle = ({ viewport }: ViewportParams) => {
    settleGeneration += 1;
    const generation = settleGeneration;
    isSettling = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (generation !== settleGeneration) {
          return;
        }
        isSettling = false;
        lastTop = clampedTopOf({ viewport });
        evaluate({ viewport, isUserScroll: false });
      }),
    );
  };

  const reset = () => {
    const viewport = liveViewport();
    state = { isShown: true, anchor: viewport === null ? 0 : clampedTopOf({ viewport }) };
    paint();
  };

  const measure = () => {
    const header = headerRef.current;
    if (header === null) {
      return;
    }
    const viewport = liveViewport();
    const isNowSliding = viewport !== null;
    headerHeight = header.offsetHeight;
    if (isNowSliding !== isSliding) {
      isSliding = isNowSliding;
      state = { isShown: true, anchor: viewport === null ? 0 : clampedTopOf({ viewport }) };
    }
    paint();
    if (viewport !== null && !isSettling && drag === null) {
      evaluate({ viewport, isUserScroll: false });
    }
  };

  const onScroll = ({ viewport }: ViewportParams) => {
    const top = clampedTopOf({ viewport });
    const before = lastTop;
    lastTop = top;
    if (!isSliding || !isLive({ viewport }) || drag !== null) {
      return;
    }
    const isUserScroll = intent.isUserScroll({ viewport, delta: top - before });
    if (isSettling) {
      state = { isShown: state.isShown, anchor: top };
      return;
    }
    evaluate({ viewport, isUserScroll });
  };

  const endDrag = () => {
    if (drag === null) {
      return;
    }
    const { viewport, startTop } = drag;
    drag = null;
    const top = clampedTopOf({ viewport });
    lastTop = top;
    if (top === startTop) {
      intent.onTrackPress({ viewport });
      return;
    }
    if (!isSliding || !isLive({ viewport }) || isSettling) {
      return;
    }
    state = { isShown: state.isShown, anchor: startTop };
    evaluate({ viewport, isUserScroll: true });
  };

  const register = ({ root, viewport }: PageScroller): (() => void) => {
    const body = bodyRef.current;
    if (claim !== null || (body !== null && !body.contains(root))) {
      return NO_RELEASE;
    }
    claim = { root, viewport };
    forget();
    const controller = new AbortController();
    const { signal } = controller;
    const passive = { passive: true, signal };
    viewport.addEventListener('scroll', () => onScroll({ viewport }), passive);
    root.addEventListener('wheel', (event) => intent.onWheel({ viewport, event }), passive);
    root.addEventListener(
      'touchstart',
      (event) => intent.onTouchStart({ viewport, event }),
      passive,
    );
    root.addEventListener('touchmove', (event) => intent.onTouchMove({ viewport, event }), passive);
    root.addEventListener('touchend', () => intent.onTouchEnd({ viewport }), passive);
    root.addEventListener('keydown', (event) => intent.onKey({ viewport, event }), { signal });
    root.addEventListener(
      'pointerdown',
      (event) => {
        if (event.target instanceof Node && viewport.contains(event.target)) {
          return;
        }
        drag = { viewport, startTop: clampedTopOf({ viewport }) };
      },
      { signal },
    );
    lastTop = viewport.scrollTop;
    state = { isShown: true, anchor: viewport.scrollTop };
    observer?.observe(root);
    if (observer !== null) {
      measure();
    }
    return () => {
      controller.abort();
      claim = null;
      forget();
      observer?.unobserve(root);
      if (observer !== null) {
        measure();
      }
    };
  };

  const attach = (): (() => void) => {
    const header = headerRef.current;
    const body = bodyRef.current;
    const controller = new AbortController();
    const { signal } = controller;
    window.addEventListener('pointerup', endDrag, { signal });
    window.addEventListener('pointercancel', endDrag, { signal });
    header?.addEventListener(
      'focusin',
      (event) => {
        if (!(event.target instanceof Element) || !isKeyboardFocus({ target: event.target })) {
          return;
        }
        isFocusHeld = true;
        if (!state.isShown) {
          reset();
        }
      },
      { signal },
    );
    header?.addEventListener(
      'focusout',
      (event) => {
        if (event.relatedTarget instanceof Node && header.contains(event.relatedTarget)) {
          return;
        }
        isFocusHeld = false;
      },
      { signal },
    );
    const resize = new ResizeObserver(measure);
    observer = resize;
    if (header !== null) {
      resize.observe(header);
    }
    if (body !== null) {
      resize.observe(body);
    }
    if (claim !== null) {
      resize.observe(claim.root);
    }
    measure();
    return () => {
      controller.abort();
      resize.disconnect();
      observer = null;
      if (extendTimer !== null) {
        clearTimeout(extendTimer);
        extendTimer = null;
      }
      forget();
      isFocusHeld = false;
    };
  };

  return { reveal: { register, holdAppScroll: intent.hold }, attach, reset };
};
