// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from './storage-keys';
import {
  bootstrapTheme,
  getAppliedTheme,
  resolveTheme,
  subscribeAppliedTheme,
  useThemeStore,
} from './theme';

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
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  root.classList.remove('light', 'dark');
  root.style.removeProperty('color-scheme');
  useThemeStore.setState({ preference: 'dark' });
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

    expect(useThemeStore.getState().preference).toBe('dark');
    expect(getAppliedTheme()).toBe('dark');
    expect(isLightApplied()).toBe(false);
  });

  it('follows a system change while Match system is stored', () => {
    const system = mockSystem({ isLight: false });
    localStorage.setItem(STORAGE_KEYS.theme, 'system');
    stop = bootstrapTheme();
    expect(getAppliedTheme()).toBe('dark');

    system.flip({ toLight: true });

    expect(useThemeStore.getState().preference).toBe('system');
    expect(getAppliedTheme()).toBe('light');
    expect(isLightApplied()).toBe(true);
  });

  it('ignores system changes under an explicit choice', () => {
    const system = mockSystem({ isLight: false });
    stop = bootstrapTheme();
    useThemeStore.getState().setPreference('dark');

    system.flip({ toLight: true });

    expect(getAppliedTheme()).toBe('dark');
  });

  it('toggles from Match system to the explicit opposite of what shows', () => {
    mockSystem({ isLight: true });
    localStorage.setItem(STORAGE_KEYS.theme, 'system');
    stop = bootstrapTheme();

    useThemeStore.getState().toggleTheme();

    expect(useThemeStore.getState().preference).toBe('dark');
    expect(getAppliedTheme()).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark');
  });

  it('follows another window switching the theme', () => {
    mockSystem({ isLight: false });
    stop = bootstrapTheme();

    window.dispatchEvent(
      new StorageEvent('storage', { key: STORAGE_KEYS.theme, newValue: 'light' }),
    );

    expect(useThemeStore.getState().preference).toBe('light');
    expect(getAppliedTheme()).toBe('light');
    expect(isLightApplied()).toBe(true);
  });

  it('ignores a storage event for an unrelated key', () => {
    mockSystem({ isLight: false });
    stop = bootstrapTheme();

    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated', newValue: 'light' }));

    expect(getAppliedTheme()).toBe('dark');
  });

  it('stops listening once the caller tears it down', () => {
    mockSystem({ isLight: false });
    const teardown = bootstrapTheme();
    teardown();

    window.dispatchEvent(
      new StorageEvent('storage', { key: STORAGE_KEYS.theme, newValue: 'light' }),
    );

    expect(getAppliedTheme()).toBe('dark');
  });
});

describe('theme switch paint', () => {
  const isSwitching = () => document.documentElement.hasAttribute('data-theme-switching');

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute('data-theme-switching');
  });

  it('holds element transitions off while the palette swaps, then releases them', () => {
    vi.useFakeTimers();

    useThemeStore.getState().setPreference('light');

    expect(isLightApplied()).toBe(true);
    expect(isSwitching()).toBe(true);
    vi.runAllTimers();
    expect(isSwitching()).toBe(false);
  });

  it('leaves transitions alone when the resolved theme does not change', () => {
    vi.useFakeTimers();
    mockSystem({ isLight: false });
    useThemeStore.getState().setPreference('dark');
    vi.runAllTimers();

    useThemeStore.getState().setPreference('system');

    expect(isLightApplied()).toBe(false);
    expect(isSwitching()).toBe(false);
  });
});

describe('applied theme', () => {
  it('swaps the html class, data-theme and color-scheme together', () => {
    const root = document.documentElement;

    useThemeStore.getState().setPreference('light');

    expect(root.classList.contains('light')).toBe(true);
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
    expect(isLightApplied()).toBe(true);

    useThemeStore.getState().setPreference('dark');

    expect(root.classList.contains('dark')).toBe(true);
    expect(root.classList.contains('light')).toBe(false);
    expect(root.style.colorScheme).toBe('dark');
    expect(isLightApplied()).toBe(false);
  });

  it('tells painters once per real swap and never for a no-op', () => {
    useThemeStore.getState().setPreference('dark');
    const painter = vi.fn();
    const unsubscribe = subscribeAppliedTheme(painter);

    useThemeStore.getState().setPreference('dark');
    expect(painter).not.toHaveBeenCalled();

    useThemeStore.getState().toggleTheme();
    expect(painter).toHaveBeenCalledTimes(1);

    unsubscribe();
    useThemeStore.getState().toggleTheme();
    expect(painter).toHaveBeenCalledTimes(1);
  });
});

type FakeTransition = {
  readonly finish: () => Promise<void>;
};

const stubViewTransitions = () => {
  const transitions: Array<FakeTransition> = [];
  const start = vi.fn((update: () => void) => {
    let resolveFinished: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });
    update();
    transitions.push({
      finish: async () => {
        resolveFinished();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      },
    });
    return {
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      finished,
      skipTransition: () => undefined,
    };
  });
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    writable: true,
    value: start,
  });
  return { start, transitions };
};

const stubMotion = ({ isReduced }: { readonly isReduced: boolean }) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduced-motion') ? isReduced : false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
};

describe('theme switch transition', () => {
  const isSwitching = () => document.documentElement.hasAttribute('data-theme-switching');

  afterEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition');
    document.documentElement.removeAttribute('data-theme-switching');
  });

  it('cross-fades the swap in one view transition and holds transitions off until it ends', async () => {
    stubMotion({ isReduced: false });
    const { start, transitions } = stubViewTransitions();

    useThemeStore.getState().setPreference('light');

    expect(start).toHaveBeenCalledTimes(1);
    expect(isLightApplied()).toBe(true);
    expect(isSwitching()).toBe(true);
    await transitions[0]?.finish();
    expect(isSwitching()).toBe(false);
  });

  it('swaps at once under reduced motion', () => {
    stubMotion({ isReduced: true });
    const { start } = stubViewTransitions();

    useThemeStore.getState().setPreference('light');

    expect(start).not.toHaveBeenCalled();
    expect(isLightApplied()).toBe(true);
  });

  it('swaps at once where view transitions do not exist', () => {
    stubMotion({ isReduced: false });

    useThemeStore.getState().setPreference('light');

    expect(isLightApplied()).toBe(true);
  });

  it('never animates the first paint', () => {
    stubMotion({ isReduced: false });
    const { start } = stubViewTransitions();
    localStorage.setItem(STORAGE_KEYS.theme, 'light');

    stop = bootstrapTheme();

    expect(start).not.toHaveBeenCalled();
    expect(isLightApplied()).toBe(true);
  });

  it('folds clicks made during a fade into one follow-up fade', async () => {
    stubMotion({ isReduced: false });
    const { start, transitions } = stubViewTransitions();

    useThemeStore.getState().toggleTheme();
    useThemeStore.getState().toggleTheme();
    useThemeStore.getState().toggleTheme();
    useThemeStore.getState().toggleTheme();

    expect(start).toHaveBeenCalledTimes(1);
    expect(isLightApplied()).toBe(true);
    await transitions[0]?.finish();
    expect(start).toHaveBeenCalledTimes(2);
    expect(isLightApplied()).toBe(false);
    await transitions[1]?.finish();
    expect(start).toHaveBeenCalledTimes(2);
  });
});
