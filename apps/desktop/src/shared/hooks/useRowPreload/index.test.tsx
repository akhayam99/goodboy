// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { useRowPreload } from '.';

type Watcher = {
  readonly callback: IntersectionObserverCallback;
  readonly options: IntersectionObserverInit | undefined;
  readonly targets: Set<Element>;
  readonly observer: IntersectionObserver;
};

const watchers: Array<Watcher> = [];

class FakeIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null;
  readonly rootMargin: string;
  readonly scrollMargin = '';
  readonly thresholds: ReadonlyArray<number> = [0];
  private readonly watcher: Watcher;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.root = options?.root ?? null;
    this.rootMargin = options?.rootMargin ?? '';
    this.watcher = { callback, options, targets: new Set(), observer: this };
    watchers.push(this.watcher);
  }

  observe(target: Element) {
    this.watcher.targets.add(target);
  }

  unobserve(target: Element) {
    this.watcher.targets.delete(target);
  }

  disconnect() {
    this.watcher.targets.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

type EntryParams = {
  readonly target: Element;
  readonly isIntersecting: boolean;
};

const entryOf = ({ target, isIntersecting }: EntryParams): IntersectionObserverEntry => {
  const rect = DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 });
  return {
    target,
    isIntersecting,
    boundingClientRect: rect,
    intersectionRect: rect,
    intersectionRatio: isIntersecting ? 1 : 0,
    rootBounds: null,
    time: 0,
  };
};

type HarnessProps = {
  readonly count: number;
};

const Harness = ({ count }: HarnessProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  useRowPreload({ viewportRef, rowSelector: '[data-rows] > li' });
  return (
    <div ref={viewportRef} data-testid="viewport">
      <ul data-rows>
        {Array.from({ length: count }, (_, index) => (
          <li key={index}>{`Row ${index}`}</li>
        ))}
      </ul>
    </div>
  );
};

const cross = ({ target, isIntersecting }: EntryParams) => {
  const watcher = watchers[0];
  if (watcher === undefined) {
    throw new Error('no observer');
  }
  act(() => {
    watcher.callback([entryOf({ target, isIntersecting })], watcher.observer);
  });
};

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
});

afterEach(() => {
  cleanup();
  watchers.length = 0;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useRowPreload', () => {
  it('watches every row against the viewport with a screen of margin above and below', () => {
    const { getByTestId, container } = render(<Harness count={3} />);

    expect(watchers).toHaveLength(1);
    expect(watchers[0]?.options?.root).toBe(getByTestId('viewport'));
    expect(watchers[0]?.options?.rootMargin).toBe('100% 0px');
    expect([...(watchers[0]?.targets ?? [])]).toEqual([...container.querySelectorAll('li')]);
  });

  it('marks a row near while it is within a screen of the view and clears it once it leaves', () => {
    const { container } = render(<Harness count={3} />);
    const row = container.querySelectorAll('li')[1]!;

    cross({ target: row, isIntersecting: true });
    expect(row.hasAttribute('data-row-near')).toBe(true);

    cross({ target: row, isIntersecting: false });
    expect(row.hasAttribute('data-row-near')).toBe(false);
  });

  it('watches rows that arrive later and lets go of rows that left', async () => {
    const { container, rerender } = render(<Harness count={2} />);
    const first = container.querySelectorAll('li')[0]!;

    rerender(<Harness count={4} />);
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersToNextFrame();
    });
    expect(watchers[0]?.targets.size).toBe(4);

    rerender(<Harness count={1} />);
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersToNextFrame();
    });
    expect([...(watchers[0]?.targets ?? [])]).toEqual([first]);
  });
});
