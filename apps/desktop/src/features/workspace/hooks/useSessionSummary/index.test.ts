// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { seedColumn, sessionOf } from '../../testing/sessionColumn';
import { useSessionSummary } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('useSessionSummary counts', () => {
  it('reports no agent count and no cost until their data has loaded', () => {
    const session = sessionOf({ goal: 'Retry policy for 429s' });
    seedColumn({ store: useAppStore, sessions: [session] });
    act(() => {
      useAppStore.setState({
        sessionPhaseRuns: {},
        sessionTelemetry: {},
        sessionLoading: {},
      });
    });

    const { result } = renderHook(() => useSessionSummary({ session }));

    expect(result.current.agentCount).toBeNull();
    expect(result.current.cost).toBeNull();
    expect(result.current.isCountsLoading).toBe(true);
  });

  it('reports a real zero once the agents and the telemetry loaded empty', () => {
    const session = sessionOf({ goal: 'Retry policy for 429s' });
    seedColumn({ store: useAppStore, sessions: [session] });
    act(() => {
      useAppStore.setState({
        sessionPhaseRuns: { [session.id]: [] },
        sessionTelemetry: { [session.id]: [] },
      });
    });

    const { result } = renderHook(() => useSessionSummary({ session }));

    expect(result.current.agentCount).toBe(0);
    expect(result.current.cost).toBe(0);
    expect(result.current.isCountsLoading).toBe(false);
  });
});
