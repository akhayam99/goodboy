// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { useScrollAnchor } from '../../../../shared/hooks/useScrollAnchor';
import { USER_SCROLL_EVENTS, useScrollPin } from './useScrollPin';

type Layout = {
  heights: number[];
  scrollTop: number;
  writes: number;
};

type HarnessProps = {
  readonly layout: Layout;
  readonly answerIndex: number;
};

type RectParams = {
  readonly top: number;
  readonly height: number;
};

type RowParams = {
  readonly layout: Layout;
  readonly index: number;
};

type LayoutParams = {
  readonly layout: Layout;
};

type IndexParams = {
  readonly index: number;
};

type FireParams = {
  readonly isReversed: boolean;
};

type ScrollParams = {
  readonly viewport: HTMLElement;
};

const VIEWPORT_HEIGHT = 500;
const ROW_SELECTOR = '[data-find-root] > li';
const callbacks: Array<() => void> = [];

class FakeResizeObserver {
  private readonly callback: () => void;
  constructor(callback: ResizeObserverCallback) {
    this.callback = () => callback([], this);
    callbacks.push(this.callback);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const rectOf = ({ top, height }: RectParams): DOMRect =>
  DOMRect.fromRect({ x: 0, y: top, width: 0, height });

const totalOf = ({ layout }: LayoutParams): number =>
  layout.heights.reduce((sum, height) => sum + height, 0);

const rowRect = ({ layout, index }: RowParams): DOMRect => {
  const top = layout.heights.slice(0, index).reduce((sum, height) => sum + height, 0);
  return rectOf({ top: top - layout.scrollTop, height: layout.heights[index] ?? 0 });
};

const Harness = ({ layout, answerIndex }: HarnessProps) => {
  const { scrollerRef, onScroll, onUserScroll, isHolding } = useScrollPin({
    deps: [layout],
  });
  useScrollAnchor({ viewportRef: scrollerRef, rowSelector: ROW_SELECTOR, shouldHold: isHolding });
  useLayoutEffect(() => {
    const viewport = scrollerRef.current;
    if (viewport === null) {
      return;
    }
    viewport.addEventListener('scroll', onScroll);
    for (const name of USER_SCROLL_EVENTS) {
      viewport.addEventListener(name, onUserScroll);
    }
    return () => {
      viewport.removeEventListener('scroll', onScroll);
      for (const name of USER_SCROLL_EVENTS) {
        viewport.removeEventListener(name, onUserScroll);
      }
    };
  }, [scrollerRef, onScroll, onUserScroll]);
  const setViewport = (node: HTMLDivElement | null) => {
    scrollerRef.current = node;
    if (node === null) {
      return;
    }
    Object.defineProperty(node, 'scrollHeight', {
      configurable: true,
      get: () => totalOf({ layout }),
    });
    Object.defineProperty(node, 'clientHeight', { configurable: true, get: () => VIEWPORT_HEIGHT });
    Object.defineProperty(node, 'scrollTop', {
      configurable: true,
      get: () => layout.scrollTop,
      set: (value: number) => {
        layout.writes += 1;
        layout.scrollTop = Math.max(0, Math.min(value, totalOf({ layout }) - VIEWPORT_HEIGHT));
      },
    });
    node.getBoundingClientRect = () => rectOf({ top: 0, height: VIEWPORT_HEIGHT });
  };
  const setRow =
    ({ index }: IndexParams) =>
    (node: HTMLLIElement | null) => {
      if (node === null) {
        return;
      }
      node.getBoundingClientRect = () => rowRect({ layout, index });
    };
  return (
    <div ref={setViewport} data-testid="viewport">
      <ul data-find-root data-scroll-content="">
        {layout.heights.map((_, index) => (
          <li
            key={index}
            ref={setRow({ index })}
            {...(index === answerIndex && { 'data-reveal-answer': `run-1:text-${index}` })}
          />
        ))}
      </ul>
    </div>
  );
};

const fireResize = ({ isReversed }: FireParams) => {
  const order = isReversed ? [...callbacks].reverse() : [...callbacks];
  act(() => {
    for (const callback of order) {
      callback();
    }
  });
};

const scroll = ({ viewport }: ScrollParams) => {
  act(() => {
    viewport.dispatchEvent(new Event('scroll'));
  });
};

const openHeldAnswer = () => {
  const layout: Layout = { heights: [200, 400, 1200], scrollTop: 0, writes: 0 };
  const view = render(<Harness layout={layout} answerIndex={2} />);
  const viewport = view.getByTestId('viewport');
  act(() => {
    vi.runOnlyPendingTimers();
  });
  scroll({ viewport });
  act(() => {
    vi.runAllTimers();
  });
  return { layout, viewport };
};

beforeEach(() => {
  callbacks.length = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useScrollPin with the shared scroll anchor', () => {
  it.each([false, true])(
    'holds a revealing answer at its top with one write when a row above grows (reversed %s)',
    (isReversed) => {
      const { layout } = openHeldAnswer();
      expect(layout.scrollTop).toBe(544);

      layout.heights[0] = 300;
      layout.writes = 0;
      fireResize({ isReversed });

      expect(layout.scrollTop).toBe(644);
      expect(layout.writes).toBe(1);
    },
  );

  it('leaves the answer growing below the reader alone', () => {
    const { layout } = openHeldAnswer();

    layout.heights[2] = 1800;
    fireResize({ isReversed: false });

    expect(layout.scrollTop).toBe(544);
  });

  it('hands the view to the anchor once the reader scrolls away from the answer', () => {
    const { layout, viewport } = openHeldAnswer();
    act(() => {
      viewport.dispatchEvent(new Event('wheel'));
    });
    layout.scrollTop = 300;
    scroll({ viewport });

    layout.heights[0] = 300;
    layout.writes = 0;
    fireResize({ isReversed: false });

    expect(layout.scrollTop).toBe(400);
    expect(layout.writes).toBe(1);
  });
});
