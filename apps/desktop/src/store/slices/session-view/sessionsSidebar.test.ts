// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';
import { createSessionViewSlice } from './index';
import type { SessionViewSlice } from './types';

const localStorageMock = {
  getItem: vi.fn<(key: string) => string | null>(() => null),
  setItem: vi.fn<(key: string, value: string) => void>(() => undefined),
};

const createSliceHarness = () => {
  let slice: SessionViewSlice;
  const set = (update: unknown): void => {
    const patch =
      typeof update === 'function'
        ? (update as (state: SessionViewSlice) => Partial<SessionViewSlice>)(slice)
        : (update as Partial<SessionViewSlice>);
    slice = { ...slice, ...patch };
  };
  const get = (): SessionViewSlice => slice;
  slice = createSessionViewSlice(set as never, get as never);
  return { getState: get };
};

beforeEach(() => {
  localStorageMock.getItem.mockReset();
  localStorageMock.getItem.mockReturnValue(null);
  localStorageMock.setItem.mockReset();
  vi.stubGlobal('localStorage', localStorageMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sessions sidebar state', () => {
  it('defaults to expanded without a persisted preference', () => {
    const store = createSliceHarness();
    expect(store.getState().sessionsSidebarCollapsed).toBe(false);
  });

  it('reads the persisted collapsed preference', () => {
    localStorageMock.getItem.mockReturnValue('1');
    const store = createSliceHarness();
    expect(store.getState().sessionsSidebarCollapsed).toBe(true);
  });

  it('sets and persists the collapsed state', () => {
    const store = createSliceHarness();
    store.getState().setSessionsSidebarCollapsed(true);
    expect(store.getState().sessionsSidebarCollapsed).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.sessionsSidebarCollapsed,
      '1',
    );
  });

  it('toggles and persists the collapsed state', () => {
    const store = createSliceHarness();
    store.getState().toggleSessionsSidebar();
    expect(store.getState().sessionsSidebarCollapsed).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.sessionsSidebarCollapsed,
      '1',
    );
  });
});
