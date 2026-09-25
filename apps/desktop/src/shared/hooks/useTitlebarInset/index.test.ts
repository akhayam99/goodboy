// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

const { windowState } = vi.hoisted(() => ({
  windowState: {
    platform: 'darwin' as 'darwin' | 'win32' | 'linux',
    isFullscreen: false,
    resized: null as (() => void) | null,
    unlisten: vi.fn(),
  },
}));

vi.mock('../../platform', () => ({
  currentPlatform: () => windowState.platform,
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    isFullscreen: async () => windowState.isFullscreen,
    onResized: async (handler: () => void) => {
      windowState.resized = handler;
      return windowState.unlisten;
    },
  }),
}));

import { PLAIN_INSET, TITLEBAR_INSET_VAR, TRAFFIC_LIGHT_INSET, useTitlebarInset } from './index';

const inset = () => document.documentElement.style.getPropertyValue(TITLEBAR_INSET_VAR);

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  windowState.platform = 'darwin';
  windowState.isFullscreen = false;
  windowState.resized = null;
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  document.documentElement.style.removeProperty(TITLEBAR_INSET_VAR);
});

describe('useTitlebarInset', () => {
  it('clears the traffic lights on a macOS window', async () => {
    renderHook(() => useTitlebarInset());
    await flush();

    expect(inset()).toBe(TRAFFIC_LIGHT_INSET);
  });

  it('drops to the plain inset in full screen and back when the window leaves it', async () => {
    renderHook(() => useTitlebarInset());
    await flush();

    windowState.isFullscreen = true;
    windowState.resized?.();
    await flush();
    expect(inset()).toBe(PLAIN_INSET);

    windowState.isFullscreen = false;
    windowState.resized?.();
    await flush();
    expect(inset()).toBe(TRAFFIC_LIGHT_INSET);
  });

  it('leaves other systems on the stylesheet default', async () => {
    windowState.platform = 'win32';
    renderHook(() => useTitlebarInset());
    await flush();

    expect(inset()).toBe('');
  });

  it('stops listening and clears the override on unmount', async () => {
    const { unmount } = renderHook(() => useTitlebarInset());
    await flush();

    unmount();
    await flush();

    expect(windowState.unlisten).toHaveBeenCalled();
    expect(inset()).toBe('');
  });
});
