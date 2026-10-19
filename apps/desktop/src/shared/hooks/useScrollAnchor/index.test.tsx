// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { useScrollAnchor } from '.';

type Layout = {
  heights: number[];
  scrollTop: number;
};

type HarnessProps = {
  readonly layout: Layout;
  readonly shouldHold?: () => boolean;
  readonly onRowMeasured?: (params: { readonly key: string; readonly px: number }) => void;
  readonly onSuspend?: (suspend: () => void) => void;
};

const VIEWPORT_HEIGHT = 300;
let resizeCallback: ResizeObserverCallback | null = null;
let fakeObserver: FakeResizeObserver | null = null;
const observedTargets = new Set<Element>();

class FakeResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
    fakeObserver = this;
  }
  observe(target: Element) {
    observedTargets.add(target);
  }
  unobserve(target: Element) {
    observedTargets.delete(target);
  }
  disconnect() {
    observedTargets.clear();
  }
}

type RectParams = {
  readonly top: number;
  readonly height: number;
};

type RowParams = {
  readonly index: number;
};

type ResizeParams = {
  readonly entries: ReadonlyArray<Element>;
};

type ScrollParams = {
  readonly viewport: HTMLElement;
};

const rectOf = ({ top, height }: RectParams): DOMRect =>
  DOMRect.fromRect({ x: 0, y: top, width: 0, height });

const Harness = ({ layout, shouldHold, onRowMeasured, onSuspend }: HarnessProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const setViewport = (node: HTMLDivElement | null) => {
    viewportRef.current = node;
    if (node === null) {
      return;
    }
    Object.defineProperty(node, 'scrollTop', {
      configurable: true,
      get: () => layout.scrollTop,
      set: (value: number) => {
        layout.scrollTop = value;
      },
    });
    node.getBoundingClientRect = () => rectOf({ top: 0, height: VIEWPORT_HEIGHT });
  };
  const setRow =
    ({ index }: RowParams) =>
    (node: HTMLLIElement | null) => {
      if (node === null) {
        return;
      }
      node.getBoundingClientRect = () => {
        const top = layout.heights.slice(0, index).reduce((sum, height) => sum + height, 0);
        return rectOf({ top: top - layout.scrollTop, height: layout.heights[index] ?? 0 });
      };
    };
  const { suspend } = useScrollAnchor({
    viewportRef,
    rowSelector: '[data-rows] > li',
    ...(shouldHold !== undefined && { shouldHold }),
    ...(onRowMeasured !== undefined && { onRowMeasured }),
  });
  onSuspend?.(suspend);
  return (
    <div>
      <div ref={setViewport} data-testid="viewport">
        <ul data-rows>
          {layout.heights.map((_, index) => (
            <li key={index} ref={setRow({ index })} data-anchor-key={`row-${index}`} />
          ))}
        </ul>
      </div>
      <div data-testid="thumb" />
    </div>
  );
};

const resizeRows = ({ entries }: ResizeParams) => {
  act(() => {
    if (resizeCallback === null || fakeObserver === null) {
      return;
    }
    const observed: ResizeObserverEntry[] = entries.map((target) => {
      const contentRect = target.getBoundingClientRect();
      const size: ResizeObserverSize = { blockSize: contentRect.height, inlineSize: 0 };
      return {
        target,
        contentRect,
        borderBoxSize: [size],
        contentBoxSize: [size],
        devicePixelContentBoxSize: [size],
      };
    });
    resizeCallback(observed, fakeObserver);
  });
};

const scroll = ({ viewport }: ScrollParams) => {
  act(() => {
    viewport.dispatchEvent(new Event('scroll'));
  });
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
});

afterEach(() => {
  cleanup();
  resizeCallback = null;
  fakeObserver = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useScrollAnchor', () => {
  it('turns css anchoring off so a Chromium webview never compensates twice', () => {
    const layout = { heights: [100, 100], scrollTop: 0 };
    const { getByTestId } = render(<Harness layout={layout} />);
    expect(getByTestId('viewport').style.overflowAnchor).toBe('none');
  });

  it('keeps the row under the reader still when a row above grows', () => {
    const layout = { heights: [100, 100, 100, 100], scrollTop: 250 };
    const { getByTestId, container } = render(<Harness layout={layout} />);
    scroll({ viewport: getByTestId('viewport') });

    layout.heights[0] = 400;
    resizeRows({ entries: [container.querySelectorAll('li')[0]!] });

    expect(layout.scrollTop).toBe(550);
  });

  it('scrolls up by the shrink of a collapsed cluster above', () => {
    const layout = { heights: [400, 100, 100, 100], scrollTop: 450 };
    const { getByTestId, container } = render(<Harness layout={layout} />);
    scroll({ viewport: getByTestId('viewport') });

    layout.heights[0] = 32;
    resizeRows({ entries: [container.querySelectorAll('li')[0]!] });

    expect(layout.scrollTop).toBe(82);
  });

  it('leaves the view alone while the bottom pin holds it', () => {
    const layout = { heights: [100, 100, 100, 100], scrollTop: 250 };
    const { getByTestId, container } = render(<Harness layout={layout} shouldHold={() => true} />);
    scroll({ viewport: getByTestId('viewport') });

    layout.heights[0] = 400;
    resizeRows({ entries: [container.querySelectorAll('li')[0]!] });

    expect(layout.scrollTop).toBe(250);
  });

  it('never compensates during a thumb drag, then anchors again once the drag settles', () => {
    const layout = { heights: [100, 100, 100, 100], scrollTop: 250 };
    const { getByTestId, container } = render(<Harness layout={layout} />);
    const viewport = getByTestId('viewport');
    scroll({ viewport });

    act(() => {
      getByTestId('thumb').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    layout.heights[0] = 120;
    resizeRows({ entries: [container.querySelectorAll('li')[0]!] });
    expect(layout.scrollTop).toBe(250);

    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup'));
      vi.advanceTimersByTime(200);
    });
    layout.heights[0] = 220;
    resizeRows({ entries: [container.querySelectorAll('li')[0]!] });
    expect(layout.scrollTop).toBe(350);
  });

  it('stands down for a programmatic scroll until the next wheel', () => {
    const layout = { heights: [100, 100, 100, 100], scrollTop: 250 };
    let suspend: (() => void) | null = null;
    const { getByTestId, container } = render(
      <Harness
        layout={layout}
        onSuspend={(next) => {
          suspend = next;
        }}
      />,
    );
    const viewport = getByTestId('viewport');
    scroll({ viewport });
    act(() => suspend?.());

    layout.heights[0] = 120;
    resizeRows({ entries: [container.querySelectorAll('li')[0]!] });
    expect(layout.scrollTop).toBe(250);

    act(() => {
      viewport.dispatchEvent(new Event('wheel'));
    });
    layout.heights[0] = 170;
    resizeRows({ entries: [container.querySelectorAll('li')[0]!] });
    expect(layout.scrollTop).toBe(300);
  });

  it('watches a row that arrives after mount, once per frame', async () => {
    const layout = { heights: [100, 100], scrollTop: 0 };
    const { container, rerender } = render(<Harness layout={layout} />);
    expect(observedTargets.size).toBe(3);

    layout.heights = [100, 100, 100];
    rerender(<Harness layout={layout} />);
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(20);
    });

    expect(observedTargets.has(container.querySelectorAll('li')[2]!)).toBe(true);
  });

  it('reports the measured height of each keyed row', () => {
    const layout = { heights: [120, 80], scrollTop: 0 };
    const onRowMeasured = vi.fn();
    const { container } = render(<Harness layout={layout} onRowMeasured={onRowMeasured} />);

    resizeRows({ entries: [...container.querySelectorAll('li')] });

    expect(onRowMeasured).toHaveBeenCalledWith({ key: 'row-0', px: 120 });
    expect(onRowMeasured).toHaveBeenCalledWith({ key: 'row-1', px: 80 });
  });
});
