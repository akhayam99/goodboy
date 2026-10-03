// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';

let useAppStore: StoryStore;
let useSessionSkeleton: typeof import('.').useSessionSkeleton;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ useSessionSkeleton } = await import('.'));
}, STORE_IMPORT_TIMEOUT_MS);

const OPEN_ID = 'session-open' as SessionId;
const OTHER_ID = 'session-other' as SessionId;

const setSyncing = ({ sessionId, isSyncing }: { sessionId: SessionId; isSyncing: boolean }) =>
  act(() => {
    const current = { ...useAppStore.getState().sessionSyncing };
    if (isSyncing) {
      current[sessionId] = true;
    }
    if (!isSyncing) {
      delete current[sessionId];
    }
    useAppStore.setState({ sessionSyncing: current });
  });

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSessionSkeleton', () => {
  it('shows the skeleton only once a refresh outlasts 250 ms', () => {
    const view = renderHook(() => useSessionSkeleton({ sessionId: OPEN_ID }));

    setSyncing({ sessionId: OPEN_ID, isSyncing: true });
    act(() => vi.advanceTimersByTime(249));
    expect(view.result.current).toBe(false);

    act(() => vi.advanceTimersByTime(1));
    expect(view.result.current).toBe(true);

    setSyncing({ sessionId: OPEN_ID, isSyncing: false });
    expect(view.result.current).toBe(false);
  });

  it('never flashes for a refresh that ends under 250 ms', () => {
    const seen: Array<boolean> = [];
    renderHook(() => {
      const isShown = useSessionSkeleton({ sessionId: OPEN_ID });
      seen.push(isShown);
      return isShown;
    });

    setSyncing({ sessionId: OPEN_ID, isSyncing: true });
    act(() => vi.advanceTimersByTime(150));
    setSyncing({ sessionId: OPEN_ID, isSyncing: false });
    act(() => vi.advanceTimersByTime(500));

    expect(seen).not.toContain(true);
  });

  it('ignores another session refreshing', () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useSessionSkeleton({ sessionId: OPEN_ID });
    });
    const before = renders;

    setSyncing({ sessionId: OTHER_ID, isSyncing: true });
    act(() => vi.advanceTimersByTime(500));

    expect(renders).toBe(before);
  });
});
