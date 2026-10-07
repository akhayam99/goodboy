// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { shellArrangement } from '../../../app/shellArrangement';
import { useClassicBars } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('useClassicBars, the legacy layout switch', () => {
  it('selects the legacy shell from a value stored under shell.classicBars', () => {
    useAppStore.setState({ settings: { 'shell.classicBars': 'true' } });

    const { result } = renderHook(() => useClassicBars());
    const arrangement = shellArrangement({
      hasWorkspace: true,
      hasActiveSession: true,
      isSidebarCollapsed: false,
      mode: result.current ? 'classic' : 'column',
    });

    expect(result.current).toBe(true);
    expect(arrangement.mode).toBe('classic');
    expect(arrangement.footer).toBe('workspace');
  });

  it('keeps the column for a stored false and for a key never saved', () => {
    useAppStore.setState({ settings: { 'shell.classicBars': 'false' } });
    expect(renderHook(() => useClassicBars()).result.current).toBe(false);

    useAppStore.setState({ settings: {} });
    expect(renderHook(() => useClassicBars()).result.current).toBe(false);
  });

  it('loads the stored value under the same key when the table has not been read', () => {
    const loadSetting = vi.fn(async (): Promise<string | null> => null);
    useAppStore.setState({ settings: {}, loadSetting });

    renderHook(() => useClassicBars());

    expect(loadSetting).toHaveBeenCalledWith('shell.classicBars');
  });
});
