// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScrollPin } from './useScrollPin';

type Box = {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
};

type Geometry = {
  readonly box: Box;
  readonly answerTop: number;
  readonly answerHeight: number;
};

type OverflowParams = {
  readonly keys: ReadonlyArray<string>;
};

type OpenParams = Geometry & {
  readonly onRevealOverflow?: (params: OverflowParams) => void;
};

const ANSWER_KEY = 'run-1:text-3';
const observers: Array<() => void> = [];

class FakeResizeObserver {
  private readonly callback: () => void;
  constructor(callback: () => void) {
    this.callback = callback;
  }
  observe(): void {
    observers.push(this.callback);
  }
  disconnect(): void {
    const at = observers.indexOf(this.callback);
    if (at >= 0) {
      observers.splice(at, 1);
    }
  }
}

const growth = (): void => {
  for (const callback of [...observers]) {
    callback();
  }
};

const rect = ({ top, bottom }: { readonly top: number; readonly bottom: number }): DOMRect =>
  DOMRect.fromRect({ x: 0, y: top, width: 0, height: bottom - top });

const domScroller = ({ box, answerTop, answerHeight }: Geometry) => {
  const el = document.createElement('div');
  const content = document.createElement('div');
  content.dataset['scrollContent'] = '';
  el.appendChild(content);
  Object.defineProperty(el, 'scrollHeight', { get: () => box.scrollHeight });
  Object.defineProperty(el, 'clientHeight', { get: () => box.clientHeight });
  Object.defineProperty(el, 'scrollTop', {
    get: () => box.scrollTop,
    set: (value: number) => {
      box.scrollTop = Math.max(0, Math.min(value, box.scrollHeight - box.clientHeight));
    },
  });
  el.getBoundingClientRect = () => rect({ top: 0, bottom: box.clientHeight });
  const answer = document.createElement('div');
  answer.dataset['revealAnswer'] = ANSWER_KEY;
  answer.getBoundingClientRect = () =>
    rect({ top: answerTop - box.scrollTop, bottom: answerTop + answerHeight - box.scrollTop });
  content.appendChild(answer);
  return { el, answer };
};

const openDom = ({ onRevealOverflow, ...geometry }: OpenParams) => {
  const { el, answer } = domScroller(geometry);
  const hook = renderHook(
    ({ key }: { key: string }) =>
      useScrollPin({
        deps: [key],
        resetKey: key,
        ...(onRevealOverflow !== undefined && { onRevealOverflow }),
      }),
    { initialProps: { key: 'a' } },
  );
  hook.result.current.scrollerRef.current = el;
  hook.rerender({ key: 'b' });
  return { ...hook, el, answer };
};

beforeEach(() => {
  observers.length = 0;
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'],
  });
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useScrollPin answer anchor', () => {
  it('follows the bottom while the answer top is below the top of the view', () => {
    const box = { scrollHeight: 1000, scrollTop: 0, clientHeight: 500 };
    const { result } = openDom({ box, answerTop: 900, answerHeight: 100 });

    box.scrollHeight = 1100;
    act(() => growth());

    expect(box.scrollTop).toBe(600);
    expect(result.current.pinned).toBe(true);
  });

  it('stops at the answer top and shows the jump button instead of chasing the bottom', () => {
    const box = { scrollHeight: 1000, scrollTop: 500, clientHeight: 500 };
    const { result } = openDom({ box, answerTop: 600, answerHeight: 400 });

    box.scrollHeight = 1800;
    act(() => growth());
    act(() => result.current.onScroll());

    expect(box.scrollTop).toBe(544);
    expect(result.current.pinned).toBe(false);

    box.scrollHeight = 2400;
    act(() => growth());
    expect(box.scrollTop).toBe(544);
  });

  it('holds the answer top until the reveal ends, then leaves the reader there', () => {
    const box = { scrollHeight: 1800, scrollTop: 0, clientHeight: 500 };
    const { answer, result } = openDom({ box, answerTop: 600, answerHeight: 400 });
    act(() => growth());
    act(() => result.current.onScroll());
    expect(result.current.pinned).toBe(false);

    answer.remove();
    box.scrollHeight = 2600;
    act(() => growth());

    expect(box.scrollTop).toBe(544);
    expect(result.current.pinned).toBe(false);
  });

  it('shows the rest at once when the written text reaches the bottom of the view', () => {
    const onRevealOverflow = vi.fn();
    const box = { scrollHeight: 1800, scrollTop: 0, clientHeight: 500 };
    openDom({ box, answerTop: 600, answerHeight: 700, onRevealOverflow });

    act(() => growth());

    expect(onRevealOverflow).toHaveBeenCalledWith({ keys: [ANSWER_KEY] });
  });

  it('does not flush while the written text still fits in the view', () => {
    const onRevealOverflow = vi.fn();
    const box = { scrollHeight: 1800, scrollTop: 0, clientHeight: 500 };
    openDom({ box, answerTop: 600, answerHeight: 200, onRevealOverflow });

    act(() => growth());

    expect(onRevealOverflow).not.toHaveBeenCalled();
  });

  it('lets the reader take over: scrolling away stops the hold', () => {
    const box = { scrollHeight: 1800, scrollTop: 0, clientHeight: 500 };
    const { result } = openDom({ box, answerTop: 600, answerHeight: 400 });
    act(() => growth());
    expect(box.scrollTop).toBe(544);

    act(() => result.current.onUserScroll());
    box.scrollTop = 200;
    act(() => result.current.onScroll());
    box.scrollHeight = 2000;
    act(() => growth());

    expect(box.scrollTop).toBe(200);
    expect(result.current.pinned).toBe(false);
  });

  it('keeps the bottom after the jump button, whatever the answer top says', () => {
    const scrollTo = vi.fn();
    const box = { scrollHeight: 1800, scrollTop: 0, clientHeight: 500 };
    const { el, result } = openDom({ box, answerTop: 600, answerHeight: 400 });
    el.scrollTo = scrollTo;
    act(() => growth());
    act(() => result.current.onScroll());
    expect(result.current.pinned).toBe(false);

    act(() => result.current.jumpToLatest());
    expect(scrollTo).toHaveBeenCalledWith({ top: 1800, behavior: 'smooth' });
    box.scrollTop = 1300;
    act(() => result.current.onScroll());
    expect(result.current.pinned).toBe(true);

    box.scrollHeight = 2200;
    act(() => growth());
    expect(box.scrollTop).toBe(2200 - 500);
  });

  it('does not yank a reader who scrolled to the bottom during the reveal back up', () => {
    const box = { scrollHeight: 1800, scrollTop: 0, clientHeight: 500 };
    const { result } = openDom({ box, answerTop: 600, answerHeight: 400 });
    act(() => growth());
    act(() => result.current.onUserScroll());
    box.scrollTop = 1290;
    act(() => result.current.onScroll());
    expect(result.current.pinned).toBe(true);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    box.scrollHeight = 2000;
    act(() => growth());

    expect(box.scrollTop).toBe(1500);
  });
});

type TurnBox = {
  turnTop: number;
  turnHeight: number;
  scrollTop: number;
  readonly clientHeight: number;
};

type TurnKeys = {
  readonly key: string;
  readonly anchorKey: string | null | undefined;
};

const TAIL_FLOOR = 48;
const ANCHOR_TOP = 40;

type TailParams = {
  readonly tail: HTMLElement;
};

type BoxParams = {
  readonly box: TurnBox;
};

const tailPx = ({ tail }: TailParams): number =>
  tail.style.height === '' ? 0 : Number.parseFloat(tail.style.height);

const turnScroller = ({ box }: BoxParams) => {
  const el = document.createElement('div');
  const content = document.createElement('div');
  content.dataset['scrollContent'] = '';
  const turn = document.createElement('div');
  turn.dataset['turn'] = '';
  content.appendChild(turn);
  el.appendChild(content);
  const tail = document.createElement('div');
  tail.style.height = `${TAIL_FLOOR}px`;
  el.appendChild(tail);
  const scrollHeight = () => box.turnTop + box.turnHeight + tailPx({ tail });
  Object.defineProperty(el, 'scrollHeight', { get: scrollHeight });
  Object.defineProperty(el, 'clientHeight', { get: () => box.clientHeight });
  Object.defineProperty(el, 'scrollTop', {
    get: () => box.scrollTop,
    set: (value: number) => {
      box.scrollTop = Math.max(0, Math.min(value, scrollHeight() - box.clientHeight));
    },
  });
  el.getBoundingClientRect = () => rect({ top: 0, bottom: box.clientHeight });
  turn.getBoundingClientRect = () =>
    rect({
      top: box.turnTop - box.scrollTop,
      bottom: box.turnTop + box.turnHeight - box.scrollTop,
    });
  return { el, tail };
};

const INITIAL_KEYS: TurnKeys = { key: 'a', anchorKey: 'user-1' };

const openTurn = ({ box }: BoxParams) => {
  const { el, tail } = turnScroller({ box });
  const hook = renderHook(
    ({ key, anchorKey }: TurnKeys) => useScrollPin({ deps: [key], resetKey: 'a', anchorKey }),
    { initialProps: INITIAL_KEYS },
  );
  hook.result.current.scrollerRef.current = el;
  hook.result.current.tailRef.current = tail;
  hook.rerender({ key: 'b', anchorKey: 'user-1' });
  return { ...hook, el, tail };
};

type SendParams = {
  readonly rerender: (props: TurnKeys) => void;
};

const sendOn = ({ rerender }: SendParams) => {
  act(() => rerender({ key: 'c', anchorKey: 'user-2' }));
};

describe('useScrollPin send anchor', () => {
  it('puts the sent message 40px under the top and leaves room below it', () => {
    const box = { turnTop: 900, turnHeight: 60, scrollTop: 700, clientHeight: 500 };
    const { rerender, result, tail } = openTurn({ box });

    sendOn({ rerender });

    expect(box.scrollTop).toBe(900 - ANCHOR_TOP);
    expect(tailPx({ tail })).toBe(TAIL_FLOOR + (500 - ANCHOR_TOP - 60 - TAIL_FLOOR));
    expect(result.current.pinned).toBe(false);
    expect(result.current.isBehind).toBe(false);
  });

  it('does not anchor the message already there when a session opens', () => {
    const box = { turnTop: 900, turnHeight: 60, scrollTop: 0, clientHeight: 500 };
    const { result } = openTurn({ box });

    expect(box.scrollTop).toBe(900 + 60 + TAIL_FLOOR - 500);
    expect(result.current.pinned).toBe(true);
  });

  it('does not follow the reply while it grows, and the room below shrinks with it', () => {
    const box = { turnTop: 900, turnHeight: 60, scrollTop: 700, clientHeight: 500 };
    const { rerender, tail } = openTurn({ box });
    sendOn({ rerender });

    box.turnHeight = 300;
    act(() => growth());

    expect(box.scrollTop).toBe(860);
    expect(tailPx({ tail })).toBe(TAIL_FLOOR + (500 - ANCHOR_TOP - 300 - TAIL_FLOOR));
  });

  it('keeps 48px under the last line once the reply is taller than the view', () => {
    const box = { turnTop: 900, turnHeight: 60, scrollTop: 700, clientHeight: 500 };
    const { rerender, tail } = openTurn({ box });
    sendOn({ rerender });

    box.turnHeight = 900;
    act(() => growth());

    expect(tailPx({ tail })).toBe(TAIL_FLOOR);
    expect(box.scrollTop).toBe(860);
  });

  it('shows the jump state when the reply passes the bottom and jumps to the last line', () => {
    const box = { turnTop: 900, turnHeight: 60, scrollTop: 700, clientHeight: 500 };
    const { rerender, result, el } = openTurn({ box });
    el.scrollTo = vi.fn();
    sendOn({ rerender });
    expect(result.current.isBehind).toBe(false);

    box.turnHeight = 900;
    act(() => growth());
    expect(result.current.isBehind).toBe(true);
    expect(box.scrollTop).toBe(860);

    act(() => result.current.jumpToLatest());
    expect(el.scrollTo).toHaveBeenCalledWith({
      top: box.turnTop + box.turnHeight + TAIL_FLOOR,
      behavior: 'smooth',
    });
  });

  it('shows the jump state when the reader scrolls up away from the bottom', () => {
    const box = { turnTop: 900, turnHeight: 60, scrollTop: 700, clientHeight: 500 };
    const { result } = openTurn({ box });
    expect(result.current.isBehind).toBe(false);

    act(() => result.current.onUserScroll());
    box.scrollTop = 300;
    act(() => result.current.onScroll());

    expect(result.current.pinned).toBe(false);
    expect(result.current.isBehind).toBe(true);
  });

  it('lets the reader take the view and stops holding the anchor', () => {
    const box = { turnTop: 900, turnHeight: 60, scrollTop: 700, clientHeight: 500 };
    const { rerender, result } = openTurn({ box });
    sendOn({ rerender });

    act(() => result.current.onUserScroll());
    box.scrollTop = 500;
    act(() => result.current.onScroll());
    box.turnHeight = 700;
    act(() => growth());

    expect(box.scrollTop).toBe(500);
    expect(result.current.isHolding()).toBe(false);
  });

  it('drops the room under a short turn on Jump to latest, so the reply is followed again', () => {
    const box = { turnTop: 900, turnHeight: 60, scrollTop: 700, clientHeight: 500 };
    const { rerender, result, el, tail } = openTurn({ box });
    Object.defineProperty(el, 'scrollTo', {
      value: (options: ScrollToOptions) => {
        box.scrollTop = options.top ?? box.scrollTop;
      },
    });
    sendOn({ rerender });
    expect(tailPx({ tail })).toBeGreaterThan(TAIL_FLOOR);

    act(() => result.current.onUserScroll());
    box.scrollTop = 600;
    act(() => result.current.onScroll());
    act(() => result.current.jumpToLatest());
    act(() => result.current.onScroll());

    expect(tailPx({ tail })).toBe(TAIL_FLOOR);
    expect(result.current.pinned).toBe(true);
  });

  it('anchors a second send on its own turn', () => {
    const box = { turnTop: 900, turnHeight: 60, scrollTop: 700, clientHeight: 500 };
    const { rerender } = openTurn({ box });
    sendOn({ rerender });

    box.turnTop = 1400;
    box.turnHeight = 60;
    act(() => rerender({ key: 'd', anchorKey: 'user-3' }));

    expect(box.scrollTop).toBe(1400 - ANCHOR_TOP);
  });

  it('waits for the transcript to be ready before it remembers a message', () => {
    const box = { turnTop: 900, turnHeight: 60, scrollTop: 0, clientHeight: 500 };
    const { rerender } = openTurn({ box });
    act(() => rerender({ key: 'c', anchorKey: undefined }));
    act(() => rerender({ key: 'd', anchorKey: 'user-1' }));

    expect(box.scrollTop).toBe(900 + 60 + TAIL_FLOOR - 500);
  });
});
