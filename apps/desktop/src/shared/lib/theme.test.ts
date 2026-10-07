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

  const stubFrames = () => {
    const queue: Array<() => void> = [];
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => queue.push(callback));
    return {
      runFrame: () => {
        const due = queue.splice(0, queue.length);
        due.forEach((callback) => callback());
      },
    };
  };

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute('data-theme-switching');
  });

  it('holds element transitions off in the swap and for one painted frame after it', () => {
    vi.useFakeTimers();
    const frames = stubFrames();

    useThemeStore.getState().setPreference('light');

    expect(isLightApplied()).toBe(true);
    expect(isSwitching()).toBe(true);
    frames.runFrame();
    expect(isSwitching()).toBe(true);
    frames.runFrame();
    expect(isSwitching()).toBe(false);
  });

  it('releases the hold on a timer where frames never run, such as a hidden window', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', () => 0);

    useThemeStore.getState().setPreference('light');
    expect(isSwitching()).toBe(true);
    vi.advanceTimersByTime(500);

    expect(isSwitching()).toBe(false);
  });

  it('keeps the hold until the frame of the latest switch when two switches land close together', () => {
    vi.useFakeTimers();
    const frames = stubFrames();

    useThemeStore.getState().setPreference('light');
    frames.runFrame();
    useThemeStore.getState().setPreference('dark');
    frames.runFrame();
    expect(isSwitching()).toBe(true);
    frames.runFrame();

    expect(isSwitching()).toBe(false);
    expect(isLightApplied()).toBe(false);
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

  it('never starts a view transition, so the window repaints once and not for every frame of a fade', () => {
    mockSystem({ isLight: false });
    stop = bootstrapTheme();
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      return { finished: Promise.resolve(), ready: Promise.resolve() };
    });
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      writable: true,
      value: startViewTransition,
    });

    useThemeStore.getState().setPreference('light');
    useThemeStore.getState().toggleTheme();
    window.dispatchEvent(
      new StorageEvent('storage', { key: STORAGE_KEYS.theme, newValue: 'light' }),
    );
    Reflect.deleteProperty(document, 'startViewTransition');

    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it('swaps the palette inside the call that asked for it', () => {
    useThemeStore.getState().setPreference('light');
    expect(isLightApplied()).toBe(true);

    useThemeStore.getState().toggleTheme();
    expect(isLightApplied()).toBe(false);
  });
});

describe('applied theme', () => {
  const collectWrites = (): {
    readonly count: () => Record<string, number>;
    readonly stop: () => void;
  } => {
    const written: Array<string> = [];
    const observer = new MutationObserver((records) => {
      records.forEach((record) => written.push(record.attributeName ?? ''));
    });
    observer.observe(document.documentElement, { attributes: true });
    return {
      count: () => {
        observer.takeRecords().forEach((record) => written.push(record.attributeName ?? ''));
        return written.reduce<Record<string, number>>(
          (tally, name) => ({ ...tally, [name]: (tally[name] ?? 0) + 1 }),
          {},
        );
      },
      stop: () => observer.disconnect(),
    };
  };

  it('writes the class, data-theme and color-scheme once each per swap, to light and back', () => {
    useThemeStore.getState().setPreference('dark');
    document.documentElement.removeAttribute('data-theme-switching');
    const writes = collectWrites();

    useThemeStore.getState().setPreference('light');
    expect(writes.count()).toEqual({
      class: 1,
      'data-theme': 1,
      style: 1,
      'data-theme-switching': 1,
    });
    writes.stop();

    document.documentElement.removeAttribute('data-theme-switching');
    const back = collectWrites();
    useThemeStore.getState().setPreference('dark');

    expect(back.count()).toEqual({
      class: 1,
      'data-theme': 1,
      style: 1,
      'data-theme-switching': 1,
    });
    back.stop();
  });

  it('writes nothing at all when the resolved theme is already applied', () => {
    useThemeStore.getState().setPreference('dark');
    const writes = collectWrites();

    useThemeStore.getState().setPreference('dark');
    useThemeStore.getState().setPreference('dark');

    expect(writes.count()).toEqual({});
    writes.stop();
  });

  it('keeps every other class on html when it swaps the theme class', () => {
    const root = document.documentElement;
    root.classList.add('tauri-window');
    useThemeStore.getState().setPreference('dark');

    useThemeStore.getState().setPreference('light');

    expect([...root.classList].sort()).toEqual(['light', 'tauri-window']);
    root.classList.remove('tauri-window');
  });

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
