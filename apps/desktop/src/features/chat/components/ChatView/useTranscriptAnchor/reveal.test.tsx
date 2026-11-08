// @vitest-environment happy-dom

import { useLayoutEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { RevealRegion, ScrollFade } from '@goodboy/ui';
import { useTranscriptAnchor } from '.';

const HEADER_PX = 48;
const VIEW_PX = 600;
const CONTENT_PX = 4000;
const ROW_PX = 120;

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

type RectParams = {
  readonly top: number;
  readonly height: number;
};

const rectOf = ({ top, height }: RectParams): DOMRect =>
  DOMRect.fromRect({ x: 0, y: top, width: 0, height });

const Transcript = () => {
  const scrollerRef = useRef<HTMLElement | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    scrollerRef.current =
      hostRef.current?.querySelector<HTMLElement>('[data-page-scroller]') ?? null;
  }, []);
  useTranscriptAnchor({ scrollerRef, isHolding: () => false });
  return (
    <div ref={hostRef} className="flex h-full flex-col">
      <RevealRegion header={<h1>ledger-core retries</h1>}>
        <ScrollFade className="min-h-0 flex-1">
          <ol data-find-root="">
            <li>
              <ul>
                {Array.from({ length: 30 }, (_, index) => (
                  <li key={index}>Message {index}</li>
                ))}
              </ul>
            </li>
          </ol>
        </ScrollFade>
      </RevealRegion>
    </div>
  );
};

const openTranscript = () => {
  let landed = 0;
  render(<Transcript />);
  const region = nodeOf({ selector: '[data-slot="reveal-region"]' });
  const body = nodeOf({ selector: '[data-slot="reveal-body"]' });
  const header = nodeOf({ selector: '[data-slot="reveal-header"]' });
  const viewport = nodeOf({ selector: '[data-page-scroller]' });
  Object.defineProperty(header, 'offsetHeight', { value: HEADER_PX, configurable: true });
  Object.defineProperty(viewport, 'scrollHeight', { value: CONTENT_PX, configurable: true });
  Object.defineProperty(viewport, 'clientHeight', { value: VIEW_PX, configurable: true });
  region.getBoundingClientRect = () => rectOf({ top: 0, height: VIEW_PX + HEADER_PX });
  body.getBoundingClientRect = () => rectOf({ top: -landed, height: VIEW_PX + HEADER_PX });
  viewport.getBoundingClientRect = () => rectOf({ top: HEADER_PX - landed, height: VIEW_PX });
  viewport.querySelectorAll('[data-find-root] > li > ul > li').forEach((row, index) => {
    row.getBoundingClientRect = () =>
      rectOf({ top: HEADER_PX - landed + index * ROW_PX - viewport.scrollTop, height: ROW_PX });
  });
  resizeAll();
  const land = (): void => {
    landed = Number.parseFloat(region.style.getPropertyValue('--reveal-shift'));
    resizeAll();
    fireEvent.scroll(viewport);
  };
  return { region, viewport, land };
};

describe('useTranscriptAnchor under the header reveal', () => {
  it('keeps the reader where they scrolled while the header slides away', () => {
    const { region, viewport, land } = openTranscript();

    fireEvent.wheel(viewport, { deltaY: 30 });
    viewport.scrollTop = 30;
    fireEvent.scroll(viewport);
    expect(region.getAttribute('data-reveal-header')).toBe('hidden');

    land();

    expect(viewport.scrollTop).toBe(30);
    expect(region.getAttribute('data-reveal-header')).toBe('hidden');
  });
});
