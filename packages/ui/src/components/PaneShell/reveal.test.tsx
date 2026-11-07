// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ScrollFade } from '../ScrollFade';
import { PageTrailContext } from './pageTrailContext';
import { PaneShell } from '.';

const HEADER_PX = 160;
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
});

afterEach(() => {
  cleanup();
  observers.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
const headerNode = (): HTMLElement => nodeOf({ selector: '[data-slot="reveal-header"]' });

const pageViewport = (): HTMLElement => {
  const viewport = nodeOf({ selector: '[data-slot="reveal-spacer"]' }).parentElement;
  if (viewport === null) {
    throw new Error('the page scroller has no viewport');
  }
  return viewport;
};

type SizeParams = {
  readonly height: number;
};

const sizeHeader = ({ height }: SizeParams): void => {
  Object.defineProperty(headerNode(), 'offsetHeight', { value: height, configurable: true });
  resizeAll();
};

const sizeViewport = (): HTMLElement => {
  const viewport = pageViewport();
  Object.defineProperty(viewport, 'scrollHeight', { value: CONTENT_PX, configurable: true });
  Object.defineProperty(viewport, 'clientHeight', { value: VIEW_PX, configurable: true });
  return viewport;
};

type ScrollParams = {
  readonly viewport: HTMLElement;
  readonly top: number;
  readonly isUser?: boolean;
};

const scrollTo = ({ viewport, top, isUser = true }: ScrollParams): void => {
  if (isUser) {
    fireEvent.wheel(viewport);
  }
  viewport.scrollTop = top;
  fireEvent.scroll(viewport);
};

const headerState = (): string | null => region().getAttribute('data-reveal-header');

type PageProps = {
  readonly tab?: string;
};

const Page = ({ tab = 'files' }: PageProps) => (
  <PageTrailContext.Provider value={<button type="button">Back to overview</button>}>
    <PaneShell
      title="Stop retried webhooks posting a second credit"
      actions={<button type="button">Fix checks</button>}
      headerMode="reveal"
      scroll="self"
      lead={<p>Push failed</p>}
    >
      <ScrollFade key={tab} className="min-h-0 flex-1">
        <p>Diff body</p>
        <ScrollFade className="max-h-40">
          <p>Inner list</p>
        </ScrollFade>
      </ScrollFade>
    </PaneShell>
  </PageTrailContext.Provider>
);

const mountPage = (): HTMLElement => {
  render(<Page />);
  sizeHeader({ height: HEADER_PX });
  return sizeViewport();
};

describe('PaneShell header reveal', () => {
  it('pins the back row and the lead outside the header that hides', () => {
    mountPage();

    const back = screen.getByRole('button', { name: 'Back to overview' });
    expect(headerNode().contains(back)).toBe(false);
    expect(headerNode().contains(screen.getByText('Push failed'))).toBe(false);
    expect(region().contains(back)).toBe(false);
    expect(headerNode().contains(screen.getByRole('heading', { level: 1 }))).toBe(true);
  });

  it('makes only the outer scroller of the body the page scroller', () => {
    mountPage();

    expect(document.querySelectorAll('[data-slot="reveal-spacer"]')).toHaveLength(1);
    expect(pageViewport().contains(screen.getByText('Inner list'))).toBe(true);
  });

  it('reserves the header height inside the page scroller, so nothing shifts on reveal', () => {
    mountPage();

    expect(region().getAttribute('data-reveal')).toBe('overlay');
    expect(region().style.getPropertyValue('--reveal-head')).toBe(`${HEADER_PX}px`);
    expect(region().style.getPropertyValue('--reveal-pad')).toBe('0px');
    expect(region().style.getPropertyValue('--reveal-inset')).toBe(`${HEADER_PX}px`);
  });

  it('hides the header on a scroll down and brings it back on a small scroll up', () => {
    const viewport = mountPage();

    scrollTo({ viewport, top: 100 });
    expect(headerState()).toBe('shown');
    scrollTo({ viewport, top: 520 });
    expect(headerState()).toBe('hidden');
    expect(region().style.getPropertyValue('--reveal-inset')).toBe('0px');
    scrollTo({ viewport, top: 516 });
    expect(headerState()).toBe('hidden');
    scrollTo({ viewport, top: 510 });
    expect(headerState()).toBe('shown');
    expect(region().style.getPropertyValue('--reveal-inset')).toBe(`${HEADER_PX}px`);
  });

  it('never hides the header on a scroll the app makes', () => {
    const viewport = mountPage();

    scrollTo({ viewport, top: 900, isUser: false });
    scrollTo({ viewport, top: 1800, isUser: false });

    expect(headerState()).toBe('shown');
  });

  it('brings the header back when keyboard focus moves into it', () => {
    const viewport = mountPage();
    scrollTo({ viewport, top: 100 });
    scrollTo({ viewport, top: 700 });
    expect(headerState()).toBe('hidden');

    act(() => {
      screen.getByRole('button', { name: 'Fix checks' }).focus();
    });

    expect(headerState()).toBe('shown');
    scrollTo({ viewport, top: 1200 });
    expect(headerState()).toBe('shown');
  });

  it('keeps the reading line when the hidden header grows', () => {
    const viewport = mountPage();
    scrollTo({ viewport, top: 100 });
    scrollTo({ viewport, top: 700 });

    sizeHeader({ height: HEADER_PX + 40 });

    expect(viewport.scrollTop).toBe(740);
    expect(headerState()).toBe('hidden');
  });

  it('slides the header and the toolbar away when the page scroller does not start the body', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rectOf(
      this: Element,
    ) {
      const top = this.closest('[data-probe]') === null ? 0 : 48;
      return DOMRect.fromRect({ x: 0, y: top, width: 800, height: 400 });
    });
    render(
      <PaneShell title="Changes" headerMode="reveal" scroll="self">
        <div>Toolbar</div>
        <div data-probe="">
          <ScrollFade className="min-h-0 flex-1">
            <p>Diff body</p>
          </ScrollFade>
        </div>
      </PaneShell>,
    );
    sizeHeader({ height: HEADER_PX });
    const viewport = sizeViewport();

    expect(region().getAttribute('data-reveal')).toBe('slide');
    expect(region().style.getPropertyValue('--reveal-pad')).toBe(`${HEADER_PX}px`);
    expect(region().style.getPropertyValue('--reveal-head')).toBe('0px');
    scrollTo({ viewport, top: 40 });
    expect(headerState()).toBe('hidden');
    expect(region().style.getPropertyValue('--reveal-shift')).toBe(`${HEADER_PX}px`);
    expect(region().style.getPropertyValue('--reveal-extend')).toBe(`${HEADER_PX}px`);
    scrollTo({ viewport, top: 30 });
    expect(headerState()).toBe('shown');
    expect(region().style.getPropertyValue('--reveal-shift')).toBe('0px');
  });

  it('keeps the header in place when nothing in the body scrolls', () => {
    render(
      <PaneShell title="Comments" headerMode="reveal" scroll="self">
        <p>No open comments</p>
      </PaneShell>,
    );
    sizeHeader({ height: HEADER_PX });

    expect(region().getAttribute('data-reveal')).toBe('static');
    expect(region().style.getPropertyValue('--reveal-pad')).toBe(`${HEADER_PX}px`);
  });

  it('shows the header again when the body swaps its scroller', () => {
    const { rerender } = render(<Page />);
    sizeHeader({ height: HEADER_PX });
    const viewport = sizeViewport();
    scrollTo({ viewport, top: 100 });
    scrollTo({ viewport, top: 900 });
    expect(headerState()).toBe('hidden');

    rerender(<Page tab="commits" />);

    expect(headerState()).toBe('shown');
    expect(pageViewport()).not.toBe(viewport);
  });
});
