// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { registerEscapeLayer } from '@goodboy/ui';
import { hitHistoryDrop, useHistoryDrag } from './index';

const ROWS = [
  { sha: 'f', top: 100, bottom: 160 },
  { sha: 'e', top: 160, bottom: 220 },
  { sha: 'd', top: 220, bottom: 280 },
  { sha: 'c', top: 280, bottom: 340 },
];

const PARAMS = {
  listRef: { current: null },
  isEnabled: true,
  canDrag: () => true,
  isAnchor: (sha: string) => sha !== 'e',
  canDropInto: ({ target }: { readonly target: string }) => target !== 'e',
  isNoopSlot: ({ sha, anchor }: { readonly sha: string; readonly anchor: string | null }) =>
    sha === 'd' && anchor === 'c',
  onMove: () => undefined,
  onCombine: () => undefined,
};

describe('history drop hit testing', () => {
  it('reads the middle of a row as a drop onto it', () => {
    expect(hitHistoryDrop({ rows: ROWS, sha: 'f', y: 250, listTop: 0, params: PARAMS })).toEqual({
      mode: 'into',
      sha: 'd',
    });
  });

  it('reads the top and bottom quarter of a row as the slot above or below it', () => {
    expect(hitHistoryDrop({ rows: ROWS, sha: 'f', y: 283, listTop: 50, params: PARAMS })).toEqual({
      mode: 'slot',
      anchor: 'c',
      y: 230,
    });
    expect(hitHistoryDrop({ rows: ROWS, sha: 'c', y: 108, listTop: 0, params: PARAMS })).toEqual({
      mode: 'slot',
      anchor: 'f',
      y: 100,
    });
  });

  it('skips a folded row when it picks the commit a slot sits above', () => {
    expect(hitHistoryDrop({ rows: ROWS, sha: 'f', y: 162, listTop: 0, params: PARAMS })).toEqual({
      mode: 'slot',
      anchor: 'd',
      y: 160,
    });
  });

  it('never folds into a row that cannot take it and reports a slot that changes nothing', () => {
    expect(hitHistoryDrop({ rows: ROWS, sha: 'f', y: 190, listTop: 0, params: PARAMS })).toEqual({
      mode: 'slot',
      anchor: 'd',
      y: 160,
    });
    expect(hitHistoryDrop({ rows: ROWS, sha: 'd', y: 283, listTop: 0, params: PARAMS })).toEqual({
      mode: 'noop',
    });
  });

  it('puts a drop under the last row at the bottom of the branch', () => {
    expect(hitHistoryDrop({ rows: ROWS, sha: 'f', y: 400, listTop: 0, params: PARAMS })).toEqual({
      mode: 'slot',
      anchor: null,
      y: 340,
    });
  });
});

describe('useHistoryDrag', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const listWithRows = () => {
    const list = document.createElement('div');
    for (const entry of ROWS) {
      const node = document.createElement('div');
      node.dataset.historyRow = entry.sha;
      vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
        top: entry.top,
        bottom: entry.bottom,
        left: 0,
        right: 500,
        width: 500,
        height: entry.bottom - entry.top,
        x: 0,
        y: entry.top,
        toJSON: () => ({}),
      } as DOMRect);
      list.appendChild(node);
    }
    document.body.appendChild(list);
    return list;
  };

  const down = ({ sha, y }: { readonly sha: string; readonly y: number }) => {
    const target = document.querySelector(`[data-history-row="${sha}"]`) as HTMLElement;
    return {
      button: 0,
      clientX: 20,
      clientY: y,
      target,
      currentTarget: target,
    } as unknown as ReactPointerEvent<HTMLElement>;
  };

  const move = ({ y }: { readonly y: number }) =>
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: y }));

  it('waits for a real drag before it picks a row up', () => {
    const list = listWithRows();
    const onPickUp = vi.fn();
    const { result } = renderHook(() =>
      useHistoryDrag({ ...PARAMS, listRef: { current: list }, onPickUp }),
    );
    act(() => result.current.onPointerDown(down({ sha: 'f', y: 130 }), 'f'));
    act(() => move({ y: 132 }));
    expect(result.current.drag).toBeNull();
    act(() => move({ y: 250 }));
    expect(onPickUp).toHaveBeenCalledWith('f');
    expect(result.current.drag?.target).toEqual({ mode: 'into', sha: 'd' });
  });

  it('commits the target on release and clears the drag', () => {
    const list = listWithRows();
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useHistoryDrag({ ...PARAMS, listRef: { current: list }, onMove }),
    );
    act(() => result.current.onPointerDown(down({ sha: 'f', y: 130 }), 'f'));
    act(() => move({ y: 283 }));
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 20, clientY: 283 }));
    });
    expect(onMove).toHaveBeenCalledWith({ sha: 'f', anchor: 'c' });
    expect(result.current.drag).toBeNull();
  });

  it('ignores a press on a disabled list or a row that cannot move', () => {
    const list = listWithRows();
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useHistoryDrag({ ...PARAMS, listRef: { current: list }, isEnabled: false, onMove }),
    );
    act(() => result.current.onPointerDown(down({ sha: 'f', y: 130 }), 'f'));
    act(() => move({ y: 283 }));
    expect(result.current.drag).toBeNull();
  });

  it('cancels on escape and on pointer cancel', () => {
    const list = listWithRows();
    const onCancel = vi.fn();
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useHistoryDrag({ ...PARAMS, listRef: { current: list }, onCancel, onMove }),
    );
    act(() => result.current.onPointerDown(down({ sha: 'f', y: 130 }), 'f'));
    act(() => move({ y: 283 }));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    act(() => result.current.onPointerDown(down({ sha: 'f', y: 130 }), 'f'));
    act(() => move({ y: 283 }));
    act(() => {
      window.dispatchEvent(new PointerEvent('pointercancel'));
    });
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('leaves escape to a layer above the drag, then cancels the drag', () => {
    const list = listWithRows();
    const onCancel = vi.fn();
    const closeAbove = vi.fn();
    const { result } = renderHook(() =>
      useHistoryDrag({ ...PARAMS, listRef: { current: list }, onCancel }),
    );
    act(() => result.current.onPointerDown(down({ sha: 'f', y: 130 }), 'f'));
    act(() => move({ y: 283 }));
    const offAbove = registerEscapeLayer(closeAbove);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
    });
    expect(closeAbove).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    expect(result.current.drag).not.toBeNull();

    offAbove();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
    });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(result.current.drag).toBeNull();
  });

  it('holds no escape layer before a drag starts or after it ends', () => {
    const list = listWithRows();
    const { result } = renderHook(() => useHistoryDrag({ ...PARAMS, listRef: { current: list } }));
    const swallowsEscape = () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        cancelable: true,
      });
      act(() => {
        window.dispatchEvent(event);
      });
      return event.defaultPrevented;
    };
    act(() => result.current.onPointerDown(down({ sha: 'f', y: 130 }), 'f'));
    expect(swallowsEscape()).toBe(false);
    act(() => move({ y: 283 }));
    act(() => {
      window.dispatchEvent(new PointerEvent('pointercancel'));
    });
    expect(swallowsEscape()).toBe(false);
  });
});
