// @vitest-environment happy-dom

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useHiddenWindowPause } from './index';

type VisibilityParams = {
  readonly state: 'visible' | 'hidden';
};

const setVisibility = ({ state }: VisibilityParams): void => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
};

const isPaused = (): boolean => document.documentElement.hasAttribute('data-window-hidden');

afterEach(() => {
  cleanup();
  setVisibility({ state: 'visible' });
});

describe('useHiddenWindowPause', () => {
  it('marks the document while the window is hidden and clears it on return', () => {
    renderHook(() => useHiddenWindowPause());
    expect(isPaused()).toBe(false);

    setVisibility({ state: 'hidden' });
    expect(isPaused()).toBe(true);

    setVisibility({ state: 'visible' });
    expect(isPaused()).toBe(false);
  });

  it('starts paused when it mounts in a hidden window', () => {
    setVisibility({ state: 'hidden' });
    renderHook(() => useHiddenWindowPause());
    expect(isPaused()).toBe(true);
  });

  it('removes the mark and the listener when it unmounts', () => {
    const view = renderHook(() => useHiddenWindowPause());
    setVisibility({ state: 'hidden' });
    view.unmount();
    expect(isPaused()).toBe(false);

    setVisibility({ state: 'hidden' });
    expect(isPaused()).toBe(false);
  });
});
