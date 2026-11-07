// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ScrollFade } from '../ScrollFade';
import { PageTrailContext } from './pageTrailContext';
import { PaneShell } from '.';

const htmlElementOf = ({ node }: { readonly node: Element | null | undefined }): HTMLElement => {
  if (!(node instanceof HTMLElement)) {
    throw new Error('html element not found');
  }
  return node;
};

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
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
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

const pageViewport = (): HTMLElement => nodeOf({ selector: '[data-page-scroller]' });

type SizeParams = {
  readonly height: number;
};

const sizeHeader = ({ height }: SizeParams): void => {
  Object.defineProperty(headerNode(), 'offsetHeight', { value: height, configurable: true });
  resizeAll();
};

type ViewportSizeParams = {
  readonly content?: number;
  readonly view?: number;
};

const sizeViewport = ({ content = CONTENT_PX, view = VIEW_PX }: ViewportSizeParams = {}) => {
  const viewport = pageViewport();
  Object.defineProperty(viewport, 'scrollHeight', { value: content, configurable: true });
  Object.defineProperty(viewport, 'clientHeight', { value: view, configurable: true });
  return viewport;
};

type ScrollParams = {
  readonly viewport: HTMLElement;
  readonly top: number;
  readonly isUser?: boolean;
};

const scrollTo = ({ viewport, top, isUser = true }: ScrollParams): void => {
  if (isUser) {
    fireEvent.wheel(viewport, { deltaY: top - viewport.scrollTop });
  }
  viewport.scrollTop = top;
  fireEvent.scroll(viewport);
};

const headerState = (): string | null => region().getAttribute('data-reveal-header');

type PageProps = {
  readonly tab?: string;
  readonly isKeyed?: boolean;
  readonly hasToolbar?: boolean;
  readonly hasRail?: boolean;
};

const Page = ({
  tab = 'files',
  isKeyed = false,
  hasToolbar = false,
  hasRail = false,
}: PageProps) => (
  <PageTrailContext.Provider value={<button type="button">Back to overview</button>}>
    <PaneShell
      title="Stop retried webhooks posting a second credit"
      actions={<button type="button">Fix checks</button>}
      headerMode="reveal"
      revealKey={tab}
      scroll="self"
      lead={<p>Push failed</p>}
    >
      {hasToolbar ? <div>Compared with main</div> : null}
      <ScrollFade key={isKeyed ? tab : 'page'} className="min-h-0 flex-1">
        <p>Diff body</p>
        <ScrollFade className="max-h-40">
          <p>Inner list</p>
        </ScrollFade>
      </ScrollFade>
      {hasRail ? (
        <ScrollFade className="min-h-0 w-64">
          <p>ledger-core/src/credit.ts</p>
        </ScrollFade>
      ) : null}
    </PaneShell>
  </PageTrailContext.Provider>
);

const mountPage = (props: PageProps = {}): HTMLElement => {
  render(<Page {...props} />);
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

    expect(document.querySelectorAll('[data-page-scroller]')).toHaveLength(1);
    expect(pageViewport().contains(screen.getByText('Inner list'))).toBe(true);
  });

  it('lets the file rail in the body scroll without moving the header', () => {
    const viewport = mountPage({ hasRail: true });
    const rail = htmlElementOf({
      node: screen.getByText('ledger-core/src/credit.ts').parentElement,
    });
    Object.defineProperty(rail, 'scrollHeight', { value: CONTENT_PX, configurable: true });
    Object.defineProperty(rail, 'clientHeight', { value: VIEW_PX, configurable: true });

    scrollTo({ viewport: rail, top: 600 });
    expect(headerState()).toBe('shown');
    scrollTo({ viewport, top: 900 });
    expect(headerState()).toBe('hidden');
    scrollTo({ viewport: rail, top: 0 });
    expect(headerState()).toBe('hidden');
    scrollTo({ viewport, top: 880 });
    expect(headerState()).toBe('shown');
  });

  it.each([false, true])(
    'hides after the same 24px and returns on 8px up, toolbar above the scroller %s',
    (hasToolbar) => {
      const viewport = mountPage({ hasToolbar });

      expect(region().getAttribute('data-reveal')).toBe('slide');
      expect(region().style.getPropertyValue('--reveal-pad')).toBe(`${HEADER_PX}px`);
      scrollTo({ viewport, top: 23 });
      expect(headerState()).toBe('shown');
      scrollTo({ viewport, top: 24 });
      expect(headerState()).toBe('hidden');
      expect(region().style.getPropertyValue('--reveal-shift')).toBe(`${HEADER_PX}px`);
      expect(region().style.getPropertyValue('--reveal-extend')).toBe(`${HEADER_PX}px`);
      scrollTo({ viewport, top: 600 });
      scrollTo({ viewport, top: 593 });
      expect(headerState()).toBe('hidden');
      scrollTo({ viewport, top: 592 });
      expect(headerState()).toBe('shown');
      expect(region().style.getPropertyValue('--reveal-shift')).toBe('0px');
    },
  );

  it('never hides the header on a scroll the app makes', () => {
    const viewport = mountPage();

    scrollTo({ viewport, top: 900, isUser: false });
    scrollTo({ viewport, top: 1800, isUser: false });

    expect(headerState()).toBe('shown');
  });

  it('never hides the header on an app jump right after the wheel', () => {
    const viewport = mountPage();
    fireEvent.wheel(viewport, { deltaY: 40 });

    scrollTo({ viewport, top: 1200, isUser: false });

    expect(headerState()).toBe('shown');
  });

  it('never hides the header on a wheel that scrolls a nested list', () => {
    const viewport = mountPage();
    const inner = htmlElementOf({ node: screen.getByText('Inner list').parentElement });
    Object.defineProperty(inner, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(inner, 'clientHeight', { value: 160, configurable: true });
    inner.style.overflowY = 'auto';
    fireEvent.wheel(screen.getByText('Inner list'), { deltaY: 200 });

    viewport.scrollTop = 200;
    fireEvent.scroll(viewport);

    expect(headerState()).toBe('shown');
  });

  it('brings the header back when keyboard focus moves into it', () => {
    const viewport = mountPage();
    scrollTo({ viewport, top: 100 });
    expect(headerState()).toBe('hidden');

    act(() => {
      screen.getByRole('button', { name: 'Fix checks' }).focus();
    });

    expect(headerState()).toBe('shown');
    scrollTo({ viewport, top: 1200 });
    expect(headerState()).toBe('shown');
  });

  it('never hides the header of a page too short to scroll without it', () => {
    const viewport = mountPage();
    sizeViewport({ content: 780, view: VIEW_PX });

    scrollTo({ viewport, top: 60 });

    expect(headerState()).toBe('shown');
  });

  it('brings the header back when the hidden page runs out of room', () => {
    const viewport = mountPage();
    sizeViewport({ content: 800, view: VIEW_PX });
    scrollTo({ viewport, top: 40 });
    expect(headerState()).toBe('hidden');

    sizeViewport({ content: 700, view: VIEW_PX + HEADER_PX });
    viewport.scrollTop = 0;
    resizeAll();

    expect(headerState()).toBe('shown');
  });

  it('keeps the header away when the bottom clamps as the body grows', () => {
    const viewport = mountPage();
    scrollTo({ viewport, top: CONTENT_PX - VIEW_PX });
    expect(headerState()).toBe('hidden');

    sizeViewport({ view: VIEW_PX + HEADER_PX });
    viewport.scrollTop = CONTENT_PX - VIEW_PX - HEADER_PX;
    fireEvent.scroll(viewport);
    resizeAll();

    expect(headerState()).toBe('hidden');
  });

  it('holds the header and the layout still while the thumb drags, then settles on release', () => {
    const viewport = mountPage();
    const root = htmlElementOf({ node: viewport.parentElement });

    fireEvent.pointerDown(root);
    [10, 11, 300, 700].forEach((top) => {
      viewport.scrollTop = top;
      fireEvent.scroll(viewport);
      resizeAll();
      expect(headerState()).toBe('shown');
      expect(region().style.getPropertyValue('--reveal-shift')).toBe('0px');
    });
    fireEvent.pointerUp(window);
    expect(headerState()).toBe('hidden');

    fireEvent.pointerDown(root);
    viewport.scrollTop = 680;
    fireEvent.scroll(viewport);
    expect(headerState()).toBe('hidden');
    fireEvent.pointerUp(window);
    expect(headerState()).toBe('shown');
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

  it('shows the header again on a tab change that keeps the same scroller', () => {
    const { rerender } = render(<Page />);
    sizeHeader({ height: HEADER_PX });
    const viewport = sizeViewport();
    scrollTo({ viewport, top: 900 });
    expect(headerState()).toBe('hidden');

    rerender(<Page tab="checks" />);

    expect(headerState()).toBe('shown');
    expect(pageViewport()).toBe(viewport);
  });

  it('shows the header again when the body swaps its scroller', () => {
    const { rerender } = render(<Page isKeyed />);
    sizeHeader({ height: HEADER_PX });
    const viewport = sizeViewport();
    scrollTo({ viewport, top: 900 });
    expect(headerState()).toBe('hidden');

    rerender(<Page isKeyed tab="commits" />);

    expect(headerState()).toBe('shown');
    expect(pageViewport()).not.toBe(viewport);
  });
});
