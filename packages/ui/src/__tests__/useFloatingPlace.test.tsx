// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFloatingPlace } from '../useFloatingPlace';

type Box = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
};

const boxOf = ({ top, left, width, height }: Box): DOMRect =>
  ({
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) satisfies DOMRect;

type Moving = {
  readonly element: HTMLElement;
  readonly moveTo: (box: Box) => void;
};

const movingElement = (initial: Box): Moving => {
  const element = document.createElement('div');
  document.body.appendChild(element);
  let box = initial;
  element.getBoundingClientRect = () => boxOf(box);
  return {
    element,
    moveTo: (next) => {
      box = next;
    },
  };
};

const setViewport = ({ width, height }: { width: number; height: number }) => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
};

beforeEach(() => {
  setViewport({ width: 1200, height: 800 });
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useFloatingPlace', () => {
  it('sits beside the anchor with its top pulled back by the gap', () => {
    const anchor = movingElement({ top: 100, left: 20, width: 40, height: 30 });
    const tip = movingElement({ top: 0, left: 0, width: 288, height: 200 });
    const { result } = renderHook(() =>
      useFloatingPlace({
        anchor: anchor.element,
        tipRef: { current: tip.element },
        isActive: true,
        side: 'right',
        alignment: 'start',
        gap: 8,
        edge: 8,
      }),
    );
    expect(result.current).toEqual({ top: 92, left: 68, side: 'right' });
  });

  it('is null while inactive, so nothing paints before a measurement', () => {
    const anchor = movingElement({ top: 100, left: 20, width: 40, height: 30 });
    const tip = movingElement({ top: 0, left: 0, width: 288, height: 200 });
    const { result } = renderHook(() =>
      useFloatingPlace({
        anchor: anchor.element,
        tipRef: { current: tip.element },
        isActive: false,
        side: 'right',
        gap: 8,
        edge: 8,
      }),
    );
    expect(result.current).toBeNull();
  });

  it('measures again when an ancestor scrolls and the anchor moves', () => {
    const anchor = movingElement({ top: 100, left: 20, width: 40, height: 30 });
    const tip = movingElement({ top: 0, left: 0, width: 288, height: 200 });
    const { result } = renderHook(() =>
      useFloatingPlace({
        anchor: anchor.element,
        tipRef: { current: tip.element },
        isActive: true,
        side: 'right',
        alignment: 'start',
        gap: 8,
        edge: 8,
      }),
    );
    expect(result.current?.top).toBe(92);
    anchor.moveTo({ top: 300, left: 20, width: 40, height: 30 });
    act(() => {
      document.body.dispatchEvent(new Event('scroll'));
    });
    expect(result.current?.top).toBe(292);
  });

  it('measures again when the window resizes and clamps to the new bottom edge', () => {
    const anchor = movingElement({ top: 600, left: 20, width: 40, height: 30 });
    const tip = movingElement({ top: 0, left: 0, width: 288, height: 200 });
    const { result } = renderHook(() =>
      useFloatingPlace({
        anchor: anchor.element,
        tipRef: { current: tip.element },
        isActive: true,
        side: 'right',
        alignment: 'start',
        gap: 8,
        edge: 8,
      }),
    );
    expect(result.current?.top).toBe(592);
    setViewport({ width: 1200, height: 500 });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current?.top).toBe(292);
  });

  it('ignores a scroll inside the floating card itself', () => {
    const anchor = movingElement({ top: 100, left: 20, width: 40, height: 30 });
    const tip = movingElement({ top: 0, left: 0, width: 288, height: 200 });
    const inner = document.createElement('div');
    tip.element.appendChild(inner);
    const { result } = renderHook(() =>
      useFloatingPlace({
        anchor: anchor.element,
        tipRef: { current: tip.element },
        isActive: true,
        side: 'right',
        alignment: 'start',
        gap: 8,
        edge: 8,
      }),
    );
    const before = result.current;
    anchor.moveTo({ top: 300, left: 20, width: 40, height: 30 });
    act(() => {
      inner.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe(before);
  });

  it('clears the boundary edge and flips to the left of the anchor when it does not fit', () => {
    const anchor = movingElement({ top: 100, left: 900, width: 40, height: 30 });
    const boundary = movingElement({ top: 0, left: 880, width: 280, height: 700 });
    const tip = movingElement({ top: 0, left: 0, width: 320, height: 200 });
    const { result } = renderHook(() =>
      useFloatingPlace({
        anchor: anchor.element,
        clearOf: boundary.element,
        tipRef: { current: tip.element },
        isActive: true,
        side: 'right',
        alignment: 'start',
        gap: 8,
        edge: 8,
      }),
    );
    expect(result.current).toEqual({ top: 92, left: 572, side: 'left' });
  });

  it('stops listening once the card closes', () => {
    const anchor = movingElement({ top: 100, left: 20, width: 40, height: 30 });
    const tip = movingElement({ top: 0, left: 0, width: 288, height: 200 });
    const removed = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() =>
      useFloatingPlace({
        anchor: anchor.element,
        tipRef: { current: tip.element },
        isActive: true,
        side: 'right',
        gap: 8,
        edge: 8,
      }),
    );
    unmount();
    const names = removed.mock.calls.map((call) => call[0]);
    expect(names).toContain('scroll');
    expect(names).toContain('resize');
    removed.mockRestore();
  });
});
