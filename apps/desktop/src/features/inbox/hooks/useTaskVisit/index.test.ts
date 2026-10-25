// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useTaskVisit } from '.';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(1_000);
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

type KeysParams = {
  readonly keys: ReadonlyArray<string>;
};

const note = ({ keys }: KeysParams): void => {
  act(() => {
    useAppStore.getState().noteTaskRecords({
      workspaceId: WORKSPACE,
      records: keys.map((key) => ({ key, isForMe: true })),
    });
  });
};

const visit = ({ keys }: KeysParams) =>
  renderHook(
    (props: KeysParams) =>
      useTaskVisit({ workspaceId: WORKSPACE, records: props.keys.map((key) => ({ key })) }),
    { initialProps: { keys } },
  );

const seenAt = (): number | null => useAppStore.getState().taskArrivals[WORKSPACE]?.seenAt ?? null;

describe('useTaskVisit', () => {
  it('marks the page looked at once it has been in front for three seconds', () => {
    note({ keys: ['a'] });
    visit({ keys: ['a'] });

    act(() => {
      vi.advanceTimersByTime(2_999);
    });
    expect(seenAt()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(seenAt()).toBe(4_000);
  });

  it('does not mark the page looked at while the window is behind', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    note({ keys: ['a'] });
    visit({ keys: ['a'] });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(seenAt()).toBeNull();
  });

  it('keeps the arrivals of this visit marked after the look moved forward', () => {
    note({ keys: ['old'] });
    act(() => {
      useAppStore.getState().markTasksSeen({ workspaceId: WORKSPACE });
    });
    vi.setSystemTime(2_000);
    note({ keys: ['old', 'fresh'] });
    const { result } = visit({ keys: ['old', 'fresh'] });
    expect([...result.current.newKeys]).toEqual(['fresh']);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(seenAt()).toBe(5_000);
    expect([...result.current.newKeys]).toEqual(['fresh']);
  });

  it('marks nothing as new on the very first visit, however much loads in', () => {
    const { result, rerender } = visit({ keys: [] });
    note({ keys: ['a', 'b'] });

    rerender({ keys: ['a', 'b'] });

    expect([...result.current.newKeys]).toEqual([]);
  });

  it('waits three seconds after the last arrival before moving the look', () => {
    note({ keys: ['a'] });
    const { rerender } = visit({ keys: ['a'] });
    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    note({ keys: ['a', 'b'] });
    rerender({ keys: ['a', 'b'] });
    act(() => {
      vi.advanceTimersByTime(2_999);
    });
    expect(seenAt()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(seenAt()).toBe(6_000);
  });
});
