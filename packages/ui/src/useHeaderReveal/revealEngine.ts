import type { RefObject } from 'react';
import { isKeyboardFocus } from '../isKeyboardFocus';
import type { HeaderReveal, PageScroller } from './headerRevealContext';
import { headerRevealOf } from './headerRevealOf';
import { REVEALS_BY_REGION } from './revealsByRegion';
import type { HeaderRevealState } from './headerRevealState';
import { scrollIntent } from './scrollIntent';

type Params = {
  readonly regionRef: RefObject<HTMLElement | null>;
  readonly headerRef: RefObject<HTMLElement | null>;
  readonly bodyRef: RefObject<HTMLElement | null>;
  readonly hasLanes?: boolean;
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

type ScrollerParams = {
  readonly scroller: PageScroller;
};

type Drag = {
  readonly viewport: HTMLElement;
  readonly startTop: number;
};

const clampedTopOf = ({ viewport }: ViewportParams): number =>
  Math.min(Math.max(0, viewport.scrollTop), rangeOf({ viewport }));

const rangeOf = ({ viewport }: ViewportParams): number =>
  Math.max(0, viewport.scrollHeight - viewport.clientHeight);

const NO_RELEASE = (): void => {};

export const revealEngine = ({
  regionRef,
  headerRef,
  bodyRef,
  hasLanes = false,
}: Params): RevealEngine => {
  const intent = scrollIntent();
  let state: HeaderRevealState = { isShown: true, anchor: 0 };
  let claim: PageScroller | null = null;
  let claims: ReadonlyArray<PageScroller> = [];
  let lastTop = 0;
  let headerHeight = 0;
  let isSliding = false;
  let isFocusHeld = false;
  let isSettling = false;
  let settleGeneration = 0;
  let observer: ResizeObserver | null = null;
  let drag: Drag | null = null;
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
      pending: isUserScroll ? intent.pendingDownOf({ viewport }) : 0,
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
    if (!isLive({ viewport })) {
      return;
    }
    const top = clampedTopOf({ viewport });
    const before = lastTop;
    lastTop = top;
    if (!isSliding || drag !== null) {
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

  const take = ({ scroller }: ScrollerParams) => {
    claim = scroller;
    forget();
    lastTop = scroller.viewport.scrollTop;
    state = { isShown: true, anchor: scroller.viewport.scrollTop };
  };

  const lead = ({ scroller }: ScrollerParams) => {
    if (claim === scroller) {
      return;
    }
    claim = scroller;
    forget();
    const { viewport } = scroller;
    lastTop = clampedTopOf({ viewport });
    state = { isShown: state.isShown, anchor: lastTop };
    if (isSliding && isLive({ viewport })) {
      evaluate({ viewport, isUserScroll: false });
    }
  };

  const register = ({ root, viewport }: PageScroller): (() => void) => {
    const body = bodyRef.current;
    if ((claim !== null && !hasLanes) || (body !== null && !body.contains(root))) {
      return NO_RELEASE;
    }
    const scroller = { root, viewport };
    claims = [...claims, scroller];
    if (claim === null) {
      take({ scroller });
    }
    const controller = new AbortController();
    const { signal } = controller;
    const passive = { passive: true, signal };
    viewport.addEventListener('scroll', () => onScroll({ viewport }), passive);
    root.addEventListener(
      'wheel',
      (event) => {
        lead({ scroller });
        intent.onWheel({ viewport, event });
      },
      passive,
    );
    root.addEventListener(
      'touchstart',
      (event) => {
        lead({ scroller });
        intent.onTouchStart({ viewport, event });
      },
      passive,
    );
    root.addEventListener('touchmove', (event) => intent.onTouchMove({ viewport, event }), passive);
    root.addEventListener('touchend', () => intent.onTouchEnd({ viewport }), passive);
    root.addEventListener(
      'keydown',
      (event) => {
        lead({ scroller });
        intent.onKey({ viewport, event });
      },
      { signal },
    );
    root.addEventListener(
      'pointerdown',
      (event) => {
        if (event.target instanceof Node && viewport.contains(event.target)) {
          return;
        }
        lead({ scroller });
        drag = { viewport, startTop: clampedTopOf({ viewport }) };
      },
      { signal },
    );
    observer?.observe(root);
    if (observer !== null) {
      measure();
    }
    return () => {
      controller.abort();
      claims = claims.filter((entry) => entry !== scroller);
      observer?.unobserve(root);
      if (claim === scroller) {
        claim = null;
        forget();
        const next = claims[0];
        if (next !== undefined) {
          take({ scroller: next });
        }
      }
      if (observer !== null) {
        measure();
      }
    };
  };

  const reveal: HeaderReveal = { register, holdAppScroll: intent.hold };

  const attach = (): (() => void) => {
    const header = headerRef.current;
    const body = bodyRef.current;
    const region = regionRef.current;
    if (region !== null) {
      REVEALS_BY_REGION.set(region, reveal);
    }
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
    for (const { root } of claims) {
      resize.observe(root);
    }
    measure();
    return () => {
      controller.abort();
      resize.disconnect();
      observer = null;
      if (region !== null) {
        REVEALS_BY_REGION.delete(region);
      }
      forget();
      isFocusHeld = false;
    };
  };

  return { reveal, attach, reset };
};
