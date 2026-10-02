// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScrollAnchor } from '.';

const FRAME_MS = 16;

type Fixture = {
  readonly scroller: HTMLDivElement;
  readonly list: HTMLDivElement;
  readonly row: HTMLDivElement;
  readonly grow: (px: number) => void;
};

const mount = (): Fixture => {
  const scroller = document.createElement('div');
  scroller.style.overflowY = 'auto';
  const list = document.createElement('div');
  const row = document.createElement('div');
  row.dataset.rowId = 'group-1';
  list.append(row);
  scroller.append(list);
  document.body.append(scroller);
  let above = 0;
  row.getBoundingClientRect = () => {
    const top = 300 + above - scroller.scrollTop;
    return DOMRect.fromRect({ x: 0, y: top, width: 400, height: 52 });
  };
  return { scroller, list, row, grow: (px) => (above += px) };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('useScrollAnchor', () => {
  it('scrolls by what grows above the row, every frame, so the row stays put', () => {
    const fixture = mount();
    const { result } = renderHook(() => useScrollAnchor({ listRef: { current: fixture.list } }));

    result.current({ rowId: 'group-1' });
    for (let frame = 0; frame < 12; frame += 1) {
      fixture.grow(6);
      vi.advanceTimersByTime(FRAME_MS);
      expect(fixture.row.getBoundingClientRect().top).toBe(300);
    }

    expect(fixture.scroller.scrollTop).toBe(72);
  });

  it('follows a fold back up the same way', () => {
    const fixture = mount();
    fixture.scroller.scrollTop = 90;
    const { result } = renderHook(() => useScrollAnchor({ listRef: { current: fixture.list } }));

    result.current({ rowId: 'group-1' });
    fixture.grow(-40);
    vi.advanceTimersByTime(FRAME_MS);

    expect(fixture.scroller.scrollTop).toBe(50);
  });

  it('lets go once the reveal has settled', () => {
    const fixture = mount();
    const { result } = renderHook(() => useScrollAnchor({ listRef: { current: fixture.list } }));

    result.current({ rowId: 'group-1' });
    vi.advanceTimersByTime(FRAME_MS * 24);
    fixture.grow(30);
    vi.advanceTimersByTime(FRAME_MS * 4);

    expect(fixture.scroller.scrollTop).toBe(0);
  });

  it('does nothing for a row that is not in the list', () => {
    const fixture = mount();
    const { result } = renderHook(() => useScrollAnchor({ listRef: { current: fixture.list } }));

    result.current({ rowId: 'missing' });
    fixture.grow(30);
    vi.advanceTimersByTime(FRAME_MS * 4);

    expect(fixture.scroller.scrollTop).toBe(0);
  });
});
