// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useDragLasso } from './index';

type Box = { left: number; top: number; width: number; height: number };

const boxOf = ({ left, top, width, height }: Box) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  }) as DOMRect;

const makeContainer = (cards: ReadonlyArray<{ id: string; box: Box }>) => {
  const container = document.createElement('div');
  container.getBoundingClientRect = () => boxOf({ left: 0, top: 0, width: 500, height: 500 });
  for (const card of cards) {
    const node = document.createElement('div');
    node.dataset.selectId = card.id;
    node.getBoundingClientRect = () => boxOf(card.box);
    container.append(node);
  }
  document.body.append(container);
  return container;
};

const down = (over: Partial<ReactPointerEvent>): ReactPointerEvent =>
  ({
    button: 0,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    altKey: false,
    shiftKey: false,
    target: document.body,
    ...over,
  }) as unknown as ReactPointerEvent;

const move = (clientX: number, clientY: number) =>
  new PointerEvent('pointermove', { pointerId: 1, clientX, clientY, bubbles: true });

const up = () => new PointerEvent('pointerup', { pointerId: 1, bubbles: true });

describe('useDragLasso', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  const setup = (options?: { requireAlt?: boolean }) => {
    const container = makeContainer([
      { id: 'a', box: { left: 10, top: 10, width: 100, height: 40 } },
      { id: 'b', box: { left: 10, top: 60, width: 100, height: 40 } },
      { id: 'c', box: { left: 10, top: 300, width: 100, height: 40 } },
    ]);
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement | null }).current = container;
    const onSelect = vi.fn();
    const hook = renderHook(() =>
      useDragLasso<'a' | 'b' | 'c'>({ containerRef: ref, onSelect, ...options }),
    );
    return { container, onSelect, hook };
  };

  it('selects every card the rectangle touches', () => {
    const { onSelect, hook } = setup();

    act(() => hook.result.current.onPointerDown(down({ clientX: 5, clientY: 5 })));
    act(() => {
      window.dispatchEvent(move(200, 90));
    });

    expect(onSelect).toHaveBeenCalledWith(['a', 'b'], 'replace');
    expect(hook.result.current.isDragging).toBe(true);
    expect(hook.result.current.rect).toEqual({ left: 5, top: 5, width: 195, height: 85 });
  });

  it('ignores gestures below the movement threshold', () => {
    const { onSelect, hook } = setup();

    act(() => hook.result.current.onPointerDown(down({ clientX: 5, clientY: 5 })));
    act(() => {
      window.dispatchEvent(move(7, 6));
    });

    expect(onSelect).not.toHaveBeenCalled();
    expect(hook.result.current.isDragging).toBe(false);
  });

  it('adds to the selection when a modifier is held', () => {
    const { onSelect, hook } = setup();

    act(() => hook.result.current.onPointerDown(down({ clientX: 5, clientY: 5, shiftKey: true })));
    act(() => {
      window.dispatchEvent(move(200, 90));
    });

    expect(onSelect).toHaveBeenCalledWith(['a', 'b'], 'add');
  });

  it('never starts on an action control unless alt is held', () => {
    const { onSelect, hook } = setup();
    const button = document.createElement('button');
    document.body.append(button);

    act(() => hook.result.current.onPointerDown(down({ clientX: 5, clientY: 5, target: button })));
    act(() => {
      window.dispatchEvent(move(200, 90));
    });
    expect(onSelect).not.toHaveBeenCalled();

    act(() =>
      hook.result.current.onPointerDown(
        down({ clientX: 5, clientY: 5, target: button, altKey: true }),
      ),
    );
    act(() => {
      window.dispatchEvent(move(200, 90));
    });
    expect(onSelect).toHaveBeenCalledWith(['a', 'b'], 'add');
  });

  it('only starts on an alt drag when the caller demands it', () => {
    const { onSelect, hook } = setup({ requireAlt: true });

    act(() => hook.result.current.onPointerDown(down({ clientX: 5, clientY: 5 })));
    act(() => {
      window.dispatchEvent(move(200, 90));
    });
    expect(onSelect).not.toHaveBeenCalled();

    act(() => hook.result.current.onPointerDown(down({ clientX: 5, clientY: 5, altKey: true })));
    act(() => {
      window.dispatchEvent(move(200, 90));
    });
    expect(onSelect).toHaveBeenCalledWith(['a', 'b'], 'add');
  });

  it('clears the marquee when the pointer lifts', () => {
    const { hook } = setup();

    act(() => hook.result.current.onPointerDown(down({ clientX: 5, clientY: 5 })));
    act(() => {
      window.dispatchEvent(move(200, 90));
    });
    act(() => {
      window.dispatchEvent(up());
    });

    expect(hook.result.current.rect).toBeNull();
    expect(hook.result.current.isDragging).toBe(false);
  });
});
