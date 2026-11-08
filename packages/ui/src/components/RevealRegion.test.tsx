// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { appScrollTo } from '../appScrollTo';
import { DrawerFrame } from './DrawerFrame';
import { RevealRegion } from './RevealRegion';
import { ScrollFade } from './ScrollFade';

const HEADER_PX = 48;
const VIEW_PX = 600;
const CONTENT_PX = 4000;

type Observed = {
  readonly callback: ResizeObserverCallback;
  readonly observer: ResizeObserver;
};

const observers = new Set<Observed>();

class FakeResizeObserver implements ResizeObserver {
  private readonly entry: Observed;

  constructor(callback: ResizeObserverCallback) {
    this.entry = { callback, observer: this };
    observers.add(this.entry);
  }

  observe() {}

  unobserve() {}

  disconnect() {
    observers.delete(this.entry);
  }
}

const resizeAll = (): void => {
  act(() => {
    [...observers].forEach((entry) => entry.callback([], entry.observer));
  });
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  cleanup();
  observers.clear();
  vi.unstubAllGlobals();
});

type NodeParams = {
  readonly selector: string;
};

const nodeOf = ({ selector }: NodeParams): HTMLElement => {
  const node = document.querySelector<HTMLElement>(selector);
  if (node === null) {
    throw new Error(`no ${selector}`);
  }
  return node;
};

const region = (): HTMLElement => nodeOf({ selector: '[data-slot="reveal-region"]' });
const headerState = (): string | null => region().getAttribute('data-reveal-header');

const sizePage = (): HTMLElement => {
  const header = nodeOf({ selector: '[data-slot="reveal-header"]' });
  Object.defineProperty(header, 'offsetHeight', { value: HEADER_PX, configurable: true });
  const viewport = nodeOf({ selector: '[data-page-scroller]' });
  Object.defineProperty(viewport, 'scrollHeight', { value: CONTENT_PX, configurable: true });
  Object.defineProperty(viewport, 'clientHeight', { value: VIEW_PX, configurable: true });
  resizeAll();
  return viewport;
};

type ScrollParams = {
  readonly viewport: HTMLElement;
  readonly top: number;
};

const wheelTo = ({ viewport, top }: ScrollParams): void => {
  fireEvent.wheel(viewport, { deltaY: top - viewport.scrollTop });
  viewport.scrollTop = top;
  fireEvent.scroll(viewport);
};

const Chat = () => (
  <div className="flex h-full flex-col">
    <RevealRegion header={<h1>Ledger questions</h1>}>
      <ScrollFade className="min-h-0 flex-1">
        <p>Messages</p>
      </ScrollFade>
    </RevealRegion>
    <ScrollFade className="max-h-80" isPageScroller={false}>
      <p>Composer dock</p>
    </ScrollFade>
  </div>
);

describe('RevealRegion', () => {
  it('hides its header on a reader scroll down and brings it back on a small scroll up', () => {
    render(<Chat />);
    const viewport = sizePage();

    wheelTo({ viewport, top: 30 });
    expect(headerState()).toBe('hidden');
    wheelTo({ viewport, top: 20 });
    expect(headerState()).toBe('shown');
  });

  it('never moves the header on a scroll the app holds, even mid wheel', () => {
    render(<Chat />);
    const viewport = sizePage();

    fireEvent.wheel(viewport, { deltaY: 400 });
    appScrollTo({ viewport, top: 400 });
    fireEvent.scroll(viewport);

    expect(headerState()).toBe('shown');
  });

  it('keeps a side scroller that opts out from becoming a page scroller', () => {
    render(<Chat />);

    const scrollers = document.querySelectorAll('[data-page-scroller]');
    expect(scrollers).toHaveLength(1);
    expect(scrollers[0]?.contains(screen.getByText('Messages'))).toBe(true);
  });
});

describe('RevealRegion with lanes', () => {
  const Board = () => (
    <div className="flex h-full flex-col">
      <RevealRegion hasLanes header={<h1>Sessions</h1>}>
        <ScrollFade orientation="horizontal" className="min-h-0 flex-1">
          {['Queued', 'Review', 'Done'].map((lane) => (
            <ScrollFade key={lane} className="min-h-0 flex-1">
              <p>{lane}</p>
            </ScrollFade>
          ))}
        </ScrollFade>
      </RevealRegion>
    </div>
  );

  it('follows the lane the reader scrolls, whichever lane mounted first', () => {
    render(<Board />);
    const header = nodeOf({ selector: '[data-slot="reveal-header"]' });
    Object.defineProperty(header, 'offsetHeight', { value: HEADER_PX, configurable: true });
    const [queued, review, done] = [
      ...document.querySelectorAll<HTMLElement>('[data-page-scroller]'),
    ];
    if (queued === undefined || review === undefined || done === undefined) {
      throw new Error('three lanes');
    }
    Object.defineProperty(queued, 'scrollHeight', { value: VIEW_PX, configurable: true });
    [queued, review, done].forEach((lane) => {
      Object.defineProperty(lane, 'clientHeight', { value: VIEW_PX, configurable: true });
    });
    [review, done].forEach((lane) => {
      Object.defineProperty(lane, 'scrollHeight', { value: CONTENT_PX, configurable: true });
    });
    resizeAll();
    review.scrollTop = 600;
    fireEvent.scroll(review);

    wheelTo({ viewport: done, top: 400 });
    expect(headerState()).toBe('hidden');
    wheelTo({ viewport: review, top: 590 });

    expect(headerState()).toBe('shown');
  });
});

describe('DrawerFrame header reveal', () => {
  const Drawer = () => (
    <div className="flex h-full flex-col">
      <DrawerFrame
        title="payments-api retry policy"
        meta="src/webhooks/retryPolicy.ts"
        toolbar={<button type="button">Display</button>}
        back={{ label: 'Back to comments', onBack: vi.fn() }}
        onClose={vi.fn()}
      >
        <p>Drawer body</p>
      </DrawerFrame>
    </div>
  );

  it('keeps the title row with close and the back link, and steps the meta and toolbar aside', () => {
    render(<Drawer />);
    const viewport = sizePage();
    const stepAside = nodeOf({ selector: '[data-slot="reveal-header"]' });

    expect(stepAside.contains(screen.getByText('src/webhooks/retryPolicy.ts'))).toBe(true);
    expect(stepAside.contains(screen.getByRole('button', { name: 'Display' }))).toBe(true);
    expect(region().contains(screen.getByRole('button', { name: 'Close' }))).toBe(false);
    expect(stepAside.contains(screen.getByRole('button', { name: /Back to comments/ }))).toBe(
      false,
    );

    wheelTo({ viewport, top: 40 });

    const close = screen.getByRole('button', { name: 'Close' });
    expect(headerState()).toBe('hidden');
    expect(region().contains(close)).toBe(false);
  });

  it('draws no reveal region when the drawer has nothing to step aside', () => {
    render(
      <DrawerFrame title="Drafts" onClose={vi.fn()}>
        <p>Drawer body</p>
      </DrawerFrame>,
    );

    expect(document.querySelector('[data-slot="reveal-region"]')).toBeNull();
    expect(document.querySelector('[data-page-scroller]')).toBeNull();
  });
});
