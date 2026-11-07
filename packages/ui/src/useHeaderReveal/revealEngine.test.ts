// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageScroller } from './headerRevealContext';
import { revealEngine, type RevealEngine } from './revealEngine';

const HEADER_PX = 160;
const VIEW_PX = 600;
const CONTENT_PX = 4000;

const frames: Array<FrameRequestCallback> = [];

const flushFrames = (): void => {
  while (frames.length > 0) {
    frames.splice(0).forEach((callback) => callback(0));
  }
};

class FakeResizeObserver implements ResizeObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
}

beforeEach(() => {
  frames.length = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

type Page = {
  readonly region: HTMLElement;
  readonly body: HTMLElement;
  readonly engine: RevealEngine;
};

const pageOf = (): Page => {
  const region = document.createElement('div');
  const header = document.createElement('div');
  const body = document.createElement('div');
  region.append(header, body);
  document.body.append(region);
  Object.defineProperty(header, 'offsetHeight', { value: HEADER_PX, configurable: true });
  const engine = revealEngine({
    regionRef: { current: region },
    headerRef: { current: header },
    bodyRef: { current: body },
  });
  engine.attach();
  return { region, body, engine };
};

type BodyParams = {
  readonly body: HTMLElement;
};

const scrollerOf = ({ body }: BodyParams): PageScroller => {
  const root = document.createElement('div');
  const viewport = document.createElement('div');
  root.append(viewport);
  body.append(root);
  Object.defineProperty(viewport, 'scrollHeight', { value: CONTENT_PX, configurable: true });
  Object.defineProperty(viewport, 'clientHeight', { value: VIEW_PX, configurable: true });
  return { root, viewport };
};

type ScrollParams = {
  readonly viewport: HTMLElement;
  readonly top: number;
};

const wheel = ({ viewport, top }: ScrollParams): void => {
  viewport.dispatchEvent(
    new WheelEvent('wheel', { deltaY: top - viewport.scrollTop, bubbles: true }),
  );
};

const appScroll = ({ viewport, top }: ScrollParams): void => {
  viewport.scrollTop = top;
  viewport.dispatchEvent(new Event('scroll'));
};

const userScroll = ({ viewport, top }: ScrollParams): void => {
  wheel({ viewport, top });
  appScroll({ viewport, top });
};

type RegionParams = {
  readonly region: HTMLElement;
};

const headerState = ({ region }: RegionParams): string | null =>
  region.getAttribute('data-reveal-header');

describe('revealEngine', () => {
  it('drops the settle of a scroller that left before its frames ran', () => {
    const { region, body, engine } = pageOf();
    const first = scrollerOf({ body });
    const release = engine.reveal.register(first);
    userScroll({ viewport: first.viewport, top: 900 });
    expect(headerState({ region })).toBe('hidden');

    release();
    first.root.remove();
    const second = scrollerOf({ body });
    engine.reveal.register(second);
    expect(headerState({ region })).toBe('shown');
    userScroll({ viewport: second.viewport, top: 20 });
    flushFrames();
    userScroll({ viewport: second.viewport, top: 30 });

    expect(headerState({ region })).toBe('hidden');
  });

  it('forgets wheel intent when a scroller registers again', () => {
    const { region, body, engine } = pageOf();
    const scroller = scrollerOf({ body });
    const release = engine.reveal.register(scroller);
    wheel({ viewport: scroller.viewport, top: 900 });

    release();
    engine.reveal.register(scroller);
    appScroll({ viewport: scroller.viewport, top: 900 });

    expect(headerState({ region })).toBe('shown');
  });

  it('forgets a thumb drag when a scroller registers again', () => {
    const { region, body, engine } = pageOf();
    const scroller = scrollerOf({ body });
    const release = engine.reveal.register(scroller);
    scroller.root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    release();
    engine.reveal.register(scroller);
    appScroll({ viewport: scroller.viewport, top: 900 });
    window.dispatchEvent(new PointerEvent('pointerup'));

    expect(headerState({ region })).toBe('shown');
  });

  it('keeps the first scroller of the body as the only one that drives the header', () => {
    const { region, body, engine } = pageOf();
    const page = scrollerOf({ body });
    const rail = scrollerOf({ body });
    engine.reveal.register(page);
    const releaseRail = engine.reveal.register(rail);

    userScroll({ viewport: rail.viewport, top: 900 });
    expect(headerState({ region })).toBe('shown');
    releaseRail();
    userScroll({ viewport: page.viewport, top: 900 });

    expect(headerState({ region })).toBe('hidden');
  });
});
