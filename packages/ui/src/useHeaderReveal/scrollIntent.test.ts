// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollIntent } from './scrollIntent';

type SizeParams = {
  readonly element: HTMLElement;
  readonly scrollHeight: number;
  readonly clientHeight: number;
};

const size = ({ element, scrollHeight, clientHeight }: SizeParams): HTMLElement => {
  Object.defineProperty(element, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(element, 'clientHeight', { value: clientHeight, configurable: true });
  return element;
};

const viewportOf = (): HTMLElement => {
  const viewport = size({
    element: document.createElement('div'),
    scrollHeight: 4000,
    clientHeight: 600,
  });
  document.body.append(viewport);
  return viewport;
};

type WheelParams = {
  readonly deltaY: number;
  readonly target: HTMLElement;
};

const wheel = ({ deltaY, target }: WheelParams): WheelEvent => {
  const event = new WheelEvent('wheel', { deltaY, bubbles: true });
  Object.defineProperty(event, 'target', { value: target });
  return event;
};

type KeyParams = {
  readonly key: string;
  readonly target: HTMLElement;
};

const key = ({ key: name, target }: KeyParams): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true });
  Object.defineProperty(event, 'target', { value: target });
  return event;
};

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('scrollIntent', () => {
  it('counts a scroll the wheel asked for, in its direction and up to its size', () => {
    const intent = scrollIntent();
    const viewport = viewportOf();
    intent.onWheel({ viewport, event: wheel({ deltaY: 100, target: viewport }) });

    expect(intent.isUserScroll({ viewport, delta: 60 })).toBe(true);
    expect(intent.isUserScroll({ viewport, delta: 40 })).toBe(true);
    expect(intent.isUserScroll({ viewport, delta: -30 })).toBe(false);
  });

  it('reads an app jump right after the wheel as the app, not the reader', () => {
    const intent = scrollIntent();
    const viewport = viewportOf();
    intent.onWheel({ viewport, event: wheel({ deltaY: 100, target: viewport }) });

    expect(intent.isUserScroll({ viewport, delta: 900 })).toBe(false);
    expect(intent.isUserScroll({ viewport, delta: 20 })).toBe(false);
  });

  it('keeps counting a momentum scroll while the wheel keeps firing', () => {
    vi.useFakeTimers();
    const intent = scrollIntent();
    const viewport = viewportOf();
    [40, 30, 20, 12, 6].forEach((deltaY) => {
      intent.onWheel({ viewport, event: wheel({ deltaY, target: viewport }) });
      vi.advanceTimersByTime(120);
      expect(intent.isUserScroll({ viewport, delta: deltaY })).toBe(true);
    });
    vi.advanceTimersByTime(600);
    expect(intent.isUserScroll({ viewport, delta: 6 })).toBe(false);
  });

  it('gives a wheel over a nested scroller to that scroller, not the page', () => {
    const intent = scrollIntent();
    const viewport = viewportOf();
    const inner = size({
      element: document.createElement('div'),
      scrollHeight: 800,
      clientHeight: 160,
    });
    inner.style.overflowY = 'auto';
    const row = document.createElement('p');
    inner.append(row);
    viewport.append(inner);
    intent.onWheel({ viewport, event: wheel({ deltaY: 100, target: row }) });

    expect(intent.isUserScroll({ viewport, delta: 100 })).toBe(false);
  });

  it('ignores scroll keys typed into an editable field', () => {
    const intent = scrollIntent();
    const viewport = viewportOf();
    const field = document.createElement('textarea');
    viewport.append(field);
    intent.onKey({ viewport, event: key({ key: 'ArrowDown', target: field }) });
    intent.onKey({ viewport, event: key({ key: ' ', target: field }) });

    expect(intent.isUserScroll({ viewport, delta: 40 })).toBe(false);
  });

  it('counts a page key on the content, a page at most', () => {
    const intent = scrollIntent();
    const viewport = viewportOf();
    intent.onKey({ viewport, event: key({ key: 'PageDown', target: viewport }) });

    expect(intent.isUserScroll({ viewport, delta: 580 })).toBe(true);
    intent.onKey({ viewport, event: key({ key: 'PageDown', target: viewport }) });
    expect(intent.isUserScroll({ viewport, delta: 1600 })).toBe(false);
  });

  it('keeps one viewport input away from another viewport', () => {
    const intent = scrollIntent();
    const viewport = viewportOf();
    const other = viewportOf();
    intent.onWheel({ viewport, event: wheel({ deltaY: 100, target: viewport }) });

    expect(intent.isUserScroll({ viewport: other, delta: 50 })).toBe(false);
  });

  it('reads every scroll as the app while a hold lasts', () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    const intent = scrollIntent();
    const viewport = viewportOf();
    intent.onWheel({ viewport, event: wheel({ deltaY: 100, target: viewport }) });
    intent.hold();

    expect(intent.isUserScroll({ viewport, delta: 50 })).toBe(false);
  });

  it('counts a thumb drag as the reader until the pointer lifts', () => {
    const intent = scrollIntent();
    const viewport = viewportOf();
    intent.onDragStart({ viewport });

    expect(intent.isUserScroll({ viewport, delta: 1200 })).toBe(true);
    intent.onDragEnd();
    expect(intent.isUserScroll({ viewport, delta: -300 })).toBe(true);
  });
});
