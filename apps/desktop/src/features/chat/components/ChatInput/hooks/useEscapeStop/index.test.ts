// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { registerEscapeLayer } from '@goodboy/ui';
import type { StopPhase } from '../../../../../../shared/hooks/useAgentStop';
import { useEscapeStop } from './index';

const stopMock = vi.fn();

const cleanups: Array<() => void> = [];

beforeEach(() => {
  vi.useFakeTimers();
  stopMock.mockReset();
});

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
  document.body.replaceChildren();
  cleanup();
  vi.useRealTimers();
});

type HookParams = {
  readonly isLive?: boolean;
  readonly phase?: StopPhase;
};

const hook = ({ isLive = true, phase = 'idle' }: HookParams = {}) =>
  renderHook(() => useEscapeStop({ isLive, phase, stop: stopMock }));

describe('useEscapeStop', () => {
  it('arms on the first Esc and stops on the second, never on the first', () => {
    const { result } = hook();

    let isFirstHandled = false;
    act(() => {
      isFirstHandled = result.current.onEscape();
    });
    expect(isFirstHandled).toBe(true);
    expect(result.current.isArmed).toBe(true);
    expect(stopMock).not.toHaveBeenCalled();

    let isSecondHandled = false;
    act(() => {
      isSecondHandled = result.current.onEscape();
    });
    expect(isSecondHandled).toBe(true);
    expect(stopMock).toHaveBeenCalledOnce();
    expect(result.current.isArmed).toBe(false);
  });

  it('forgets the first Esc after three seconds', () => {
    const { result } = hook();
    act(() => {
      result.current.onEscape();
    });

    act(() => {
      vi.advanceTimersByTime(3_100);
    });

    expect(result.current.isArmed).toBe(false);
    act(() => {
      result.current.onEscape();
    });
    expect(stopMock).not.toHaveBeenCalled();
  });

  it('loses to an open layer: the key closes that layer and the agent keeps running', () => {
    const { result } = hook();
    cleanups.push(registerEscapeLayer(vi.fn()));

    let isHandled = true;
    act(() => {
      isHandled = result.current.onEscape();
    });

    expect(isHandled).toBe(false);
    expect(result.current.isArmed).toBe(false);
    expect(stopMock).not.toHaveBeenCalled();
  });

  it('loses to a menu or dialog in the page', () => {
    const { result } = hook();
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    document.body.append(menu);

    let isHandled = true;
    act(() => {
      isHandled = result.current.onEscape();
    });

    expect(isHandled).toBe(false);
    expect(stopMock).not.toHaveBeenCalled();
  });

  it('does not count the page level layer that goes up as a layer in the way', () => {
    const { result } = hook();
    cleanups.push(registerEscapeLayer(vi.fn(), true));

    let isHandled = false;
    act(() => {
      isHandled = result.current.onEscape();
    });

    expect(isHandled).toBe(true);
    expect(result.current.isArmed).toBe(true);
  });

  it('leaves the key alone when no turn runs', () => {
    const { result } = hook({ isLive: false });

    let isHandled = true;
    act(() => {
      isHandled = result.current.onEscape();
    });

    expect(isHandled).toBe(false);
    expect(stopMock).not.toHaveBeenCalled();
  });

  it('leaves the key alone while the stop is already on its way', () => {
    const { result } = hook({ phase: 'stopping' });

    let isHandled = true;
    act(() => {
      isHandled = result.current.onEscape();
    });

    expect(isHandled).toBe(false);
    expect(stopMock).not.toHaveBeenCalled();
  });

  it('disarms when the turn ends', () => {
    const { result, rerender } = renderHook(
      (props: { readonly isLive: boolean }) =>
        useEscapeStop({ isLive: props.isLive, phase: 'idle', stop: stopMock }),
      { initialProps: { isLive: true } },
    );
    act(() => {
      result.current.onEscape();
    });
    expect(result.current.isArmed).toBe(true);

    rerender({ isLive: false });

    expect(result.current.isArmed).toBe(false);
  });
});
