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

type ExtendParams = {
  readonly region: HTMLElement;
  readonly shift: string;
  readonly isShown: boolean;
};

const clampedTopOf = ({ viewport }: ViewportParams): number =>
  Math.min(Math.max(0, viewport.scrollTop), rangeOf({ viewport }));

const rangeOf = ({ viewport }: ViewportParams): number =>
  Math.max(0, viewport.scrollHeight - viewport.clientHeight);

export const revealEngine = ({ regionRef, headerRef, bodyRef }: Params): RevealEngine => {
  const scrollers = new Map<PageScroller, AbortController>();
  const lastTops = new Map<HTMLElement, number>();
  const intent = scrollIntent();
  let state: HeaderRevealState = { isShown: true, anchor: 0 };
  let source: HTMLElement | null = null;
  let headerHeight = 0;
  let isSliding = false;
  let isFocusHeld = false;
  let isSettling = false;
  let observer: ResizeObserver | null = null;
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

  const liveScrollers = (): ReadonlyArray<PageScroller> => {
    const body = bodyRef.current;
    if (body === null) {
      return [];
    }
    return [...scrollers.keys()].filter((scroller) => body.contains(scroller.root));
  };

  const isLive = ({ viewport }: ViewportParams): boolean =>
    liveScrollers().some((scroller) => scroller.viewport === viewport);

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
    isSettling = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        isSettling = false;
        lastTops.set(viewport, clampedTopOf({ viewport }));
        evaluate({ viewport, isUserScroll: false });
      }),
    );
  };

  const reset = () => {
    state = { isShown: true, anchor: source === null ? 0 : clampedTopOf({ viewport: source }) };
    paint();
  };

  const measure = () => {
    const header = headerRef.current;
    if (header === null) {
      return;
    }
    const isNowSliding = liveScrollers().length > 0;
    headerHeight = header.offsetHeight;
    if (isNowSliding !== isSliding) {
      isSliding = isNowSliding;
      state = { isShown: true, anchor: source === null ? 0 : clampedTopOf({ viewport: source }) };
    }
    paint();
    if (isSliding && source !== null && !isSettling && isLive({ viewport: source })) {
      evaluate({ viewport: source, isUserScroll: false });
    }
  };

  const onScroll = ({ viewport }: ViewportParams) => {
    const top = clampedTopOf({ viewport });
    const before = lastTops.get(viewport) ?? top;
    lastTops.set(viewport, top);
    if (!isSliding || !isLive({ viewport })) {
      return;
    }
    const isUserScroll = intent.isUserScroll({ viewport, delta: top - before });
    if (source !== viewport) {
      source = viewport;
      state = { isShown: state.isShown, anchor: before };
    }
    if (isSettling) {
      state = { isShown: state.isShown, anchor: top };
      return;
    }
    evaluate({ viewport, isUserScroll });
  };

  const register = ({ root, viewport }: PageScroller): (() => void) => {
    const scroller = { root, viewport };
    const controller = new AbortController();
    const { signal } = controller;
    const passive = { passive: true, signal };
    viewport.addEventListener('scroll', () => onScroll({ viewport }), passive);
    root.addEventListener('wheel', (event) => intent.onWheel({ viewport, event }), passive);
    root.addEventListener('touchmove', () => intent.onTouch({ viewport }), passive);
    root.addEventListener('keydown', (event) => intent.onKey({ viewport, event }), { signal });
    root.addEventListener(
      'pointerdown',
      (event) => {
        if (event.target instanceof Node && viewport.contains(event.target)) {
          return;
        }
        intent.onDragStart({ viewport });
      },
      { signal },
    );
    scrollers.set(scroller, controller);
    lastTops.set(viewport, viewport.scrollTop);
    observer?.observe(root);
    const body = bodyRef.current;
    if (body === null || body.contains(root)) {
      source = viewport;
      state = { isShown: true, anchor: viewport.scrollTop };
    }
    if (observer !== null) {
      measure();
    }
    return () => {
      controller.abort();
      scrollers.delete(scroller);
      lastTops.delete(viewport);
      observer?.unobserve(root);
      if (source === viewport) {
        source = null;
      }
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
    window.addEventListener('pointerup', intent.onDragEnd, { signal });
    window.addEventListener('pointercancel', intent.onDragEnd, { signal });
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
    scrollers.forEach((_controller, scroller) => resize.observe(scroller.root));
    measure();
    return () => {
      controller.abort();
      resize.disconnect();
      observer = null;
      if (extendTimer !== null) {
        clearTimeout(extendTimer);
        extendTimer = null;
      }
      intent.onDragEnd();
      isFocusHeld = false;
    };
  };

  return { reveal: { register, holdAppScroll: intent.hold }, attach, reset };
};
