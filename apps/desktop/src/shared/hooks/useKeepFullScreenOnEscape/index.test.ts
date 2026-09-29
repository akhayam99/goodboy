// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { registerEscapeLayer } from '@goodboy/ui';

const { platformState } = vi.hoisted(() => ({
  platformState: { platform: 'darwin' as 'darwin' | 'win32' | 'linux' },
}));

vi.mock('../../platform', () => ({
  currentPlatform: () => platformState.platform,
}));

import { useKeepFullScreenOnEscape } from './index';

const press = (key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  document.body.dispatchEvent(event);
  return event;
};

beforeEach(() => {
  platformState.platform = 'darwin';
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
});

describe('useKeepFullScreenOnEscape', () => {
  it('prevents the default of an Escape nothing handled', () => {
    renderHook(() => useKeepFullScreenOnEscape());

    expect(press('Escape').defaultPrevented).toBe(true);
  });

  it('leaves other keys alone', () => {
    renderHook(() => useKeepFullScreenOnEscape());

    expect(press('Enter').defaultPrevented).toBe(false);
    expect(press('a').defaultPrevented).toBe(false);
  });

  it('leaves Escape alone while composing text', () => {
    renderHook(() => useKeepFullScreenOnEscape());

    expect(press('Escape', { isComposing: true }).defaultPrevented).toBe(false);
  });

  it('does nothing outside a macOS Tauri window', () => {
    platformState.platform = 'win32';
    renderHook(() => useKeepFullScreenOnEscape());
    expect(press('Escape').defaultPrevented).toBe(false);

    platformState.platform = 'darwin';
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    renderHook(() => useKeepFullScreenOnEscape());
    expect(press('Escape').defaultPrevented).toBe(false);
  });

  it('stops preventing Escape after unmount', () => {
    const { unmount } = renderHook(() => useKeepFullScreenOnEscape());
    unmount();

    expect(press('Escape').defaultPrevented).toBe(false);
  });

  it('runs after window handlers registered later, so they still see an unhandled Escape', () => {
    renderHook(() => useKeepFullScreenOnEscape());
    const seenDefaultPrevented: boolean[] = [];
    const lateHandler = (event: KeyboardEvent) => {
      seenDefaultPrevented.push(event.defaultPrevented);
    };
    window.addEventListener('keydown', lateHandler);

    const event = press('Escape');
    window.removeEventListener('keydown', lateHandler);

    expect(seenDefaultPrevented).toEqual([false]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('still closes an open escape layer on Escape', () => {
    renderHook(() => useKeepFullScreenOnEscape());
    const onClose = vi.fn();
    const unregister = registerEscapeLayer(onClose);

    const event = press('Escape');
    unregister();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('closes only the top layer per Escape', () => {
    renderHook(() => useKeepFullScreenOnEscape());
    const lower = vi.fn();
    const upper = vi.fn();
    const offLower = registerEscapeLayer(lower);
    const offUpper = registerEscapeLayer(upper);

    press('Escape');
    offUpper();
    press('Escape');
    offLower();

    expect(upper).toHaveBeenCalledTimes(1);
    expect(lower).toHaveBeenCalledTimes(1);
  });

  it('keeps a handler that already prevented Escape untouched', () => {
    renderHook(() => useKeepFullScreenOnEscape());
    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
    };
    window.addEventListener('keydown', handler);

    const event = press('Escape');
    window.removeEventListener('keydown', handler);

    expect(event.defaultPrevented).toBe(true);
  });
});
