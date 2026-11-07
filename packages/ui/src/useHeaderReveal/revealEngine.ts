import type { RefObject } from 'react';
import { isKeyboardFocus } from '../isKeyboardFocus';
import { DURATION_BASE_MS } from '../motionTimings';
import { prefersReducedMotion } from '../prefersReducedMotion';
import type { HeaderReveal, PageScroller } from './headerRevealContext';
import { headerRevealOf, type HeaderRevealState } from './headerRevealOf';

const INTENT_MS = 500;
const AT_TOP_SLACK_PX = 1;
const SCROLL_KEYS: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

type Params = {
  readonly regionRef: RefObject<HTMLElement | null>;
  readonly headerRef: RefObject<HTMLElement | null>;
  readonly bodyRef: RefObject<HTMLElement | null>;
};

type Mode = 'static' | 'overlay' | 'slide';

export type RevealEngine = {
  readonly reveal: HeaderReveal;
  readonly attach: () => () => void;
};

type ExtendParams = {
  readonly region: HTMLElement;
  readonly shift: string;
  readonly isShown: boolean;
};

type ScrollerParams = {
  readonly viewport: HTMLElement;
};

type BodyParams = {
  readonly body: HTMLElement;
};

type TopParams = BodyParams & {
  readonly scroller: PageScroller;
};

const paddingTopOf = ({ body }: BodyParams): number => {
  const value = Number.parseFloat(getComputedStyle(body).paddingTop);
  return Number.isNaN(value) ? 0 : value;
};

const isAtBodyTop = ({ body, scroller }: TopParams): boolean =>
  scroller.root.getBoundingClientRect().top -
    body.getBoundingClientRect().top -
    paddingTopOf({ body }) <=
  AT_TOP_SLACK_PX;

const clampedTopOf = ({ viewport }: ScrollerParams): number => {
  const max = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  return Math.min(Math.max(0, viewport.scrollTop), max);
};

export const revealEngine = ({ regionRef, headerRef, bodyRef }: Params): RevealEngine => {
  const scrollers = new Map<PageScroller, AbortController>();
  let state: HeaderRevealState = { isShown: true, anchor: 0 };
  let source: HTMLElement | null = null;
  const lastTops = new Map<HTMLElement, number>();
  let headerHeight = 0;
  let mode: Mode = 'static';
  let intentAt = Number.NEGATIVE_INFINITY;
  let isDragging = false;
  let isFocusHeld = false;
  let observer: ResizeObserver | null = null;
  let isSettling = false;
  let extendTimer: ReturnType<typeof setTimeout> | null = null;

  const markIntent = () => {
    intentAt = performance.now();
  };

  const isUserScroll = (): boolean => isDragging || performance.now() - intentAt <= INTENT_MS;

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
    const isOverlay = mode === 'overlay';
    const isSlide = mode === 'slide';
    const isShown = mode === 'static' || state.isShown;
    const shift = isSlide && !isShown ? `${headerHeight}px` : '0px';
    region.setAttribute('data-reveal', mode);
    region.setAttribute('data-reveal-header', isShown ? 'shown' : 'hidden');
    region.style.setProperty('--reveal-pad', isOverlay ? '0px' : `${headerHeight}px`);
    region.style.setProperty('--reveal-head', isOverlay ? `${headerHeight}px` : '0px');
    region.style.setProperty('--reveal-inset', isOverlay && isShown ? `${headerHeight}px` : '0px');
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

  const measure = () => {
    const header = headerRef.current;
    const body = bodyRef.current;
    if (header === null || body === null) {
      return;
    }
    const live = liveScrollers();
    const nextHeight = header.offsetHeight;
    const nextMode: Mode = live.some((scroller) => isAtBodyTop({ body, scroller }))
      ? 'overlay'
      : live.length > 0
        ? 'slide'
        : 'static';
    const delta = nextHeight - headerHeight;
    if (delta !== 0 && mode === 'overlay' && nextMode === 'overlay' && !state.isShown) {
      live.forEach((scroller) => {
        if (scroller.viewport.scrollTop > 0) {
          scroller.viewport.scrollTop += delta;
        }
      });
      state = { isShown: false, anchor: state.anchor + delta };
    }
    headerHeight = nextHeight;
    if (nextMode !== mode) {
      mode = nextMode;
      state = { isShown: true, anchor: source?.scrollTop ?? 0 };
    }
    paint();
  };

  const settle = ({ viewport }: ScrollerParams) => {
    isSettling = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        isSettling = false;
        state = { isShown: state.isShown, anchor: clampedTopOf({ viewport }) };
      }),
    );
  };

  const isLive = ({ viewport }: ScrollerParams): boolean =>
    liveScrollers().some((scroller) => scroller.viewport === viewport);

  const onScroll = ({ viewport }: ScrollerParams) => {
    const top = clampedTopOf({ viewport });
    const before = lastTops.get(viewport) ?? top;
    lastTops.set(viewport, top);
    if (mode === 'static' || !isLive({ viewport })) {
      return;
    }
    if (source !== viewport) {
      source = viewport;
      state = { isShown: state.isShown, anchor: before };
    }
    if (isSettling) {
      state = { isShown: state.isShown, anchor: clampedTopOf({ viewport }) };
      return;
    }
    const next = headerRevealOf({
      state,
      scrollTop: top,
      headerHeight: mode === 'overlay' ? headerHeight : 0,
      isUserScroll: isUserScroll(),
      isFocusHeld,
    });
    const isFlipped = next.isShown !== state.isShown;
    state = next;
    if (!isFlipped) {
      return;
    }
    paint();
    if (mode === 'slide') {
      settle({ viewport });
    }
  };

  const register = ({ root, viewport }: PageScroller): (() => void) => {
    const scroller = { root, viewport };
    const controller = new AbortController();
    const { signal } = controller;
    viewport.addEventListener('scroll', () => onScroll({ viewport }), { passive: true, signal });
    root.addEventListener('wheel', markIntent, { passive: true, signal });
    root.addEventListener('touchmove', markIntent, { passive: true, signal });
    root.addEventListener(
      'keydown',
      (event) => {
        if (SCROLL_KEYS.has(event.key)) {
          markIntent();
        }
      },
      { signal },
    );
    root.addEventListener(
      'pointerdown',
      (event) => {
        if (event.target instanceof Node && viewport.contains(event.target)) {
          return;
        }
        isDragging = true;
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
    const release = () => {
      if (!isDragging) {
        return;
      }
      isDragging = false;
      markIntent();
    };
    window.addEventListener('pointerup', release, { signal });
    window.addEventListener('pointercancel', release, { signal });
    header?.addEventListener(
      'focusin',
      (event) => {
        if (!(event.target instanceof Element) || !isKeyboardFocus({ target: event.target })) {
          return;
        }
        isFocusHeld = true;
        if (state.isShown) {
          return;
        }
        state = { isShown: true, anchor: source?.scrollTop ?? 0 };
        paint();
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
      isDragging = false;
      isFocusHeld = false;
    };
  };

  return { reveal: { register }, attach };
};
