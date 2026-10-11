// @vitest-environment happy-dom

import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { registerEscapeLayer } from '@goodboy/ui';
import { usePointerDrag } from './index';

type Engine = ReturnType<typeof usePointerDrag<string>>;

type MountParams = {
  readonly engine: Engine;
  readonly tag?: 'div' | 'button';
};

type MoveParams = {
  readonly x: number;
  readonly y: number;
  readonly isAlt?: boolean;
};

type SpyParams = {
  readonly spy: ReturnType<typeof vi.spyOn>;
};

const mountHandle = ({ engine, tag = 'div' }: MountParams) => {
  render(
    createElement(tag, {
      'data-testid': 'handle',
      onPointerDown: (event) => engine.onPointerDown({ event, payload: 'a' }),
    }),
  );
};

const press = () => {
  fireEvent.pointerDown(screen.getByTestId('handle'), { button: 0, clientX: 10, clientY: 10 });
};

const move = ({ x, y, isAlt = false }: MoveParams) => {
  act(() => {
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: x, clientY: y, altKey: isAlt }),
    );
  });
};

const release = ({ x, y }: MoveParams) => {
  act(() => {
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y }));
  });
};

const listenerCount = ({ spy }: SpyParams) =>
  spy.mock.calls.filter(([type]: ReadonlyArray<unknown>) =>
    ['pointermove', 'pointerup', 'pointercancel'].includes(String(type)),
  ).length;

describe('usePointerDrag', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not start under 5px and fires no drop, so a click goes through', () => {
    const onStart = vi.fn();
    const onRelease = vi.fn();
    const { result } = renderHook(() => usePointerDrag<string>({ onStart, onRelease }));
    mountHandle({ engine: result.current });
    press();
    move({ x: 12, y: 13 });
    release({ x: 12, y: 13 });
    expect(onStart).not.toHaveBeenCalled();
    expect(onRelease).not.toHaveBeenCalled();
  });

  it('starts past 5px, reports moves with the alt key and releases at the pointer', () => {
    const onStart = vi.fn();
    const onMove = vi.fn();
    const onRelease = vi.fn();
    const { result } = renderHook(() => usePointerDrag<string>({ onStart, onMove, onRelease }));
    mountHandle({ engine: result.current });
    press();
    move({ x: 40, y: 10, isAlt: true });
    expect(onStart).toHaveBeenCalledOnce();
    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({ payload: 'a', x: 40, y: 10, isAlt: true }),
    );
    release({ x: 50, y: 20 });
    expect(onRelease).toHaveBeenCalledWith(expect.objectContaining({ payload: 'a', x: 50, y: 20 }));
  });

  it('cancels on escape and never drops', () => {
    const onCancel = vi.fn();
    const onRelease = vi.fn();
    const { result } = renderHook(() => usePointerDrag<string>({ onCancel, onRelease }));
    mountHandle({ engine: result.current });
    press();
    move({ x: 40, y: 10 });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
    });
    release({ x: 40, y: 10 });
    expect(onCancel).toHaveBeenCalledWith({ payload: 'a' });
    expect(onRelease).not.toHaveBeenCalled();
  });

  it('leaves escape to a layer above the drag', () => {
    const onCancel = vi.fn();
    const { result } = renderHook(() => usePointerDrag<string>({ onCancel }));
    mountHandle({ engine: result.current });
    press();
    move({ x: 40, y: 10 });
    const closeAbove = vi.fn();
    const off = registerEscapeLayer(closeAbove);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
    });
    expect(closeAbove).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    off();
    release({ x: 40, y: 10 });
  });

  it('removes every window listener after a drop, a cancel and an unmount', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const open = () => listenerCount({ spy: add }) - listenerCount({ spy: remove });
    const { result, unmount } = renderHook(() => usePointerDrag<string>({}));
    mountHandle({ engine: result.current });
    press();
    expect(open()).toBe(3);
    move({ x: 40, y: 10 });
    release({ x: 40, y: 10 });
    expect(open()).toBe(0);
    press();
    act(() => {
      window.dispatchEvent(new PointerEvent('pointercancel'));
    });
    expect(open()).toBe(0);
    press();
    expect(open()).toBe(3);
    unmount();
    expect(open()).toBe(0);
  });

  it('refuses to start on a button unless the caller opts in', () => {
    const onStart = vi.fn();
    const plain = renderHook(() => usePointerDrag<string>({ onStart }));
    mountHandle({ engine: plain.result.current, tag: 'button' });
    press();
    move({ x: 40, y: 10 });
    expect(onStart).not.toHaveBeenCalled();
    cleanup();
    const opted = renderHook(() => usePointerDrag<string>({ onStart, canStartOnControls: true }));
    mountHandle({ engine: opted.result.current, tag: 'button' });
    press();
    move({ x: 40, y: 10 });
    expect(onStart).toHaveBeenCalledOnce();
    release({ x: 40, y: 10 });
  });

  it('ignores a press when disabled', () => {
    const onStart = vi.fn();
    const { result } = renderHook(() => usePointerDrag<string>({ isEnabled: false, onStart }));
    mountHandle({ engine: result.current });
    press();
    move({ x: 40, y: 10 });
    expect(onStart).not.toHaveBeenCalled();
  });
});
