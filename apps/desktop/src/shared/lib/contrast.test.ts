// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapContrast, switchContrast, useContrastStore } from './contrast';
import { STORAGE_KEYS } from './storage-keys';

type Listener = () => void;

const mockSystem = ({ isMore }: { readonly isMore: boolean }) => {
  const listeners = new Set<Listener>();
  const query = {
    matches: isMore,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => query);
  return {
    flip: ({ isMore }: { readonly isMore: boolean }) => {
      query.matches = isMore;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
};

const attribute = (): string | null => document.documentElement.getAttribute('data-contrast');

let stop: () => void = () => undefined;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-contrast');
  useContrastStore.setState({ isSwitchOn: false });
});

afterEach(() => {
  stop();
  vi.unstubAllGlobals();
});

describe('more contrast', () => {
  it('stays standard when neither the system nor the switch asks for more', () => {
    mockSystem({ isMore: false });

    stop = bootstrapContrast();

    expect(attribute()).toBeNull();
    expect(useContrastStore.getState().isSwitchOn).toBe(false);
  });

  it('follows prefers-contrast: more at launch and when the system changes', () => {
    const system = mockSystem({ isMore: true });
    stop = bootstrapContrast();
    expect(attribute()).toBe('more');

    system.flip({ isMore: false });
    expect(attribute()).toBeNull();

    system.flip({ isMore: true });
    expect(attribute()).toBe('more');
  });

  it('turns on from the switch, remembers it, and keeps it when the system answers standard', () => {
    const system = mockSystem({ isMore: false });
    stop = bootstrapContrast();

    switchContrast({ isOn: true });

    expect(attribute()).toBe('more');
    expect(localStorage.getItem(STORAGE_KEYS.contrast)).toBe('more');
    system.flip({ isMore: false });
    expect(attribute()).toBe('more');
  });

  it('reads the saved switch on the next launch', () => {
    localStorage.setItem(STORAGE_KEYS.contrast, 'more');
    mockSystem({ isMore: false });

    stop = bootstrapContrast();

    expect(attribute()).toBe('more');
    expect(useContrastStore.getState().isSwitchOn).toBe(true);
  });

  it('keeps more contrast on while the system asks for it, even with the switch off', () => {
    mockSystem({ isMore: true });
    stop = bootstrapContrast();

    switchContrast({ isOn: false });

    expect(attribute()).toBe('more');
    expect(localStorage.getItem(STORAGE_KEYS.contrast)).toBe('standard');
  });

  it('follows the switch from another window and stops listening on cleanup', () => {
    const system = mockSystem({ isMore: false });
    stop = bootstrapContrast();

    window.dispatchEvent(
      new StorageEvent('storage', { key: STORAGE_KEYS.contrast, newValue: 'more' }),
    );
    expect(attribute()).toBe('more');
    expect(system.listenerCount()).toBe(1);

    stop();
    expect(system.listenerCount()).toBe(0);
  });
});
