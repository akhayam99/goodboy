// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from './storage-keys';
import { bootstrapTheme, resolveTheme, useThemeStore, withViewTransition } from './theme';

type Listener = () => void;

const mockSystem = ({ isLight }: { readonly isLight: boolean }) => {
  const listeners = new Set<Listener>();
  const query = {
    matches: isLight,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => query);
  return {
    flip: ({ toLight }: { readonly toLight: boolean }) => {
      query.matches = toLight;
      listeners.forEach((listener) => listener());
    },
  };
};

const isLightApplied = () => document.documentElement.getAttribute('data-theme') === 'light';

let stop: () => void = () => undefined;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  useThemeStore.setState({ preference: 'dark', theme: 'dark' });
});

afterEach(() => {
  stop();
  vi.unstubAllGlobals();
});

describe('resolveTheme', () => {
  it('follows the system only for the system preference', () => {
    expect(resolveTheme({ preference: 'system', systemIsLight: true })).toBe('light');
    expect(resolveTheme({ preference: 'system', systemIsLight: false })).toBe('dark');
    expect(resolveTheme({ preference: 'dark', systemIsLight: true })).toBe('dark');
    expect(resolveTheme({ preference: 'light', systemIsLight: false })).toBe('light');
  });
});

describe('theme store', () => {
  it('stays dark on a fresh install whatever the system says', () => {
    mockSystem({ isLight: true });
    stop = bootstrapTheme();

    expect(useThemeStore.getState()).toMatchObject({ preference: 'dark', theme: 'dark' });
    expect(isLightApplied()).toBe(false);
  });

  it('follows a system change while Match system is stored', () => {
    const system = mockSystem({ isLight: false });
    localStorage.setItem(STORAGE_KEYS.theme, 'system');
    stop = bootstrapTheme();
    expect(useThemeStore.getState().theme).toBe('dark');

    system.flip({ toLight: true });

    expect(useThemeStore.getState()).toMatchObject({ preference: 'system', theme: 'light' });
    expect(isLightApplied()).toBe(true);
  });

  it('ignores system changes under an explicit choice', () => {
    const system = mockSystem({ isLight: false });
    stop = bootstrapTheme();
    useThemeStore.getState().setPreference('dark');

    system.flip({ toLight: true });

    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('toggles from Match system to the explicit opposite of what shows', () => {
    mockSystem({ isLight: true });
    localStorage.setItem(STORAGE_KEYS.theme, 'system');
    stop = bootstrapTheme();

    useThemeStore.getState().toggleTheme();

    expect(useThemeStore.getState()).toMatchObject({ preference: 'dark', theme: 'dark' });
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark');
  });

  it('follows another window switching the theme', () => {
    mockSystem({ isLight: false });
    stop = bootstrapTheme();

    window.dispatchEvent(
      new StorageEvent('storage', { key: STORAGE_KEYS.theme, newValue: 'light' }),
    );

    expect(useThemeStore.getState()).toMatchObject({ preference: 'light', theme: 'light' });
    expect(isLightApplied()).toBe(true);
  });

  it('ignores a storage event for an unrelated key', () => {
    mockSystem({ isLight: false });
    stop = bootstrapTheme();

    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated', newValue: 'light' }));

    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('stops listening once the caller tears it down', () => {
    mockSystem({ isLight: false });
    const teardown = bootstrapTheme();
    teardown();

    window.dispatchEvent(
      new StorageEvent('storage', { key: STORAGE_KEYS.theme, newValue: 'light' }),
    );

    expect(useThemeStore.getState().theme).toBe('dark');
  });
});

type MutableDocument = { startViewTransition?: unknown };

const setStartViewTransition = (value: unknown): void => {
  (document as unknown as MutableDocument).startViewTransition = value;
};

describe('withViewTransition', () => {
  afterEach(() => {
    setStartViewTransition(undefined);
  });

  it('runs the update directly when the browser has no View Transition API', () => {
    setStartViewTransition(undefined);
    const update = vi.fn();

    withViewTransition(update);

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('runs the update through startViewTransition when available', () => {
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return {};
    });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    setStartViewTransition(startViewTransition);
    const update = vi.fn();

    withViewTransition(update);

    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('skips the view transition and runs the update directly under reduced motion', () => {
    const startViewTransition = vi.fn();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    setStartViewTransition(startViewTransition);
    const update = vi.fn();

    withViewTransition(update);

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
