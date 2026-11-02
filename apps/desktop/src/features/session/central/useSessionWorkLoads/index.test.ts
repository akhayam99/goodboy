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
import { cleanup, renderHook } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useSessionWorkLoads } from '.';

const FIRST = 'session-northwind' as SessionId;
const SECOND = 'session-cascadia' as SessionId;

let useAppStore: StoryStore;

const loads = {
  events: vi.fn(async () => undefined),
  artifacts: vi.fn(async () => undefined),
  context: vi.fn(async () => undefined),
  answered: vi.fn(async () => undefined),
  dismissed: vi.fn(async () => undefined),
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  for (const load of Object.values(loads)) {
    load.mockClear();
  }
  useAppStore.setState({
    loadSessionEvents: loads.events,
    loadSessionArtifacts: loads.artifacts,
    loadSessionContextItems: loads.context,
    loadSessionAnsweredQuestions: loads.answered,
    loadSessionDismissedQuestions: loads.dismissed,
  } as never);
});

afterEach(cleanup);

describe('useSessionWorkLoads', () => {
  it('runs one set of loads for two consumers of the same session', () => {
    renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));
    renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));

    expect(loads.events).toHaveBeenCalledTimes(1);
    expect(loads.artifacts).toHaveBeenCalledTimes(1);
    expect(loads.context).toHaveBeenCalledTimes(1);
    expect(loads.answered).toHaveBeenCalledTimes(1);
    expect(loads.dismissed).toHaveBeenCalledTimes(1);
  });

  it('loads each session once', () => {
    renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));
    renderHook(() => useSessionWorkLoads({ sessionId: SECOND }));

    expect(loads.events).toHaveBeenCalledTimes(2);
    expect(loads.events).toHaveBeenCalledWith({ sessionId: SECOND });
  });

  it('loads again when the last consumer left and one comes back', () => {
    const first = renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));
    first.unmount();
    renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));

    expect(loads.events).toHaveBeenCalledTimes(2);
  });

  it('keeps the loads quiet while one consumer is still mounted', () => {
    const first = renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));
    renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));
    first.unmount();
    renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));

    expect(loads.events).toHaveBeenCalledTimes(1);
  });
});
