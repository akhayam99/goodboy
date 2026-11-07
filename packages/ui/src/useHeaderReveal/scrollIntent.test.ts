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

type TouchAtParams = {
  readonly y: number;
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

  it('reports the downward wheel distance still on its way, and none going up', () => {
    const intent = scrollIntent();
    const viewport = viewportOf();
    expect(intent.pendingDownOf({ viewport })).toBe(0);
    intent.onWheel({ viewport, event: wheel({ deltaY: 100, target: viewport }) });
    intent.isUserScroll({ viewport, delta: 30 });
    expect(intent.pendingDownOf({ viewport })).toBe(70);
    intent.onWheel({ viewport, event: wheel({ deltaY: -100, target: viewport }) });
    expect(intent.pendingDownOf({ viewport })).toBe(0);
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

  it('spends the wheel budget on real movement, so a later app move is not counted', () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    const intent = scrollIntent();
    const viewport = viewportOf();
    intent.onWheel({ viewport, event: wheel({ deltaY: 100, target: viewport }) });

    expect(intent.isUserScroll({ viewport, delta: 20 })).toBe(true);
    intent.hold();
    expect(intent.isUserScroll({ viewport, delta: 60 })).toBe(false);
  });

  it('stops counting once the budget is spent, small moves included', () => {
    const intent = scrollIntent();
    const viewport = viewportOf();
    intent.onWheel({ viewport, event: wheel({ deltaY: 40, target: viewport }) });

    expect(intent.isUserScroll({ viewport, delta: 40 })).toBe(true);
    expect(intent.isUserScroll({ viewport, delta: 4 })).toBe(false);
    expect(intent.isUserScroll({ viewport, delta: 4 })).toBe(false);
  });

  it('keeps a newer hold when an older one ends', () => {
    const frames: Array<FrameRequestCallback> = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const runFrames = () => {
      frames.splice(0).forEach((callback) => callback(0));
    };
    const intent = scrollIntent();
    const viewport = viewportOf();
    intent.hold();
    runFrames();
    intent.hold();
    runFrames();
    intent.onWheel({ viewport, event: wheel({ deltaY: 100, target: viewport }) });

    expect(intent.isUserScroll({ viewport, delta: 20 })).toBe(false);
    runFrames();
    runFrames();
    intent.onWheel({ viewport, event: wheel({ deltaY: 100, target: viewport }) });
    expect(intent.isUserScroll({ viewport, delta: 20 })).toBe(true);
  });

  it('reads a touch drag by its direction and size, on its own viewport', () => {
    const intent = scrollIntent();
    const viewport = viewportOf();
    const other = viewportOf();
    const touchAt = ({ y }: TouchAtParams): TouchEvent => {
      const event = new TouchEvent('touchmove', { bubbles: true });
      Object.defineProperty(event, 'touches', { value: [{ clientY: y }] });
      Object.defineProperty(event, 'target', { value: viewport });
      return event;
    };
    intent.onTouchStart({ viewport, event: touchAt({ y: 400 }) });
    intent.onTouchMove({ viewport, event: touchAt({ y: 340 }) });

    expect(intent.isUserScroll({ viewport: other, delta: 30 })).toBe(false);
    expect(intent.isUserScroll({ viewport, delta: -30 })).toBe(false);
    expect(intent.isUserScroll({ viewport, delta: 60 })).toBe(true);
    expect(intent.isUserScroll({ viewport, delta: 200 })).toBe(false);
  });

  it('reads every scroll as the app while a hold lasts', () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    const intent = scrollIntent();
    const viewport = viewportOf();
    intent.onWheel({ viewport, event: wheel({ deltaY: 100, target: viewport }) });
    intent.hold();

    expect(intent.isUserScroll({ viewport, delta: 50 })).toBe(false);
  });

  it('counts a track press as one page in either direction', () => {
    const intent = scrollIntent();
    const viewport = viewportOf();
    intent.onTrackPress({ viewport });

    expect(intent.isUserScroll({ viewport, delta: -580 })).toBe(true);
    expect(intent.isUserScroll({ viewport, delta: 300 })).toBe(false);
  });
});
