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
import { listAutoTreesOfSession } from '@goodboy/db';
import { brandId, type SessionId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { aView } from '../../testing/autoViewFixtures';
import { useAutoBoardWatch } from './index';

const HARBORLINE = brandId<SessionId>({ value: 'session-harborline' });
const NORTHWIND = brandId<SessionId>({ value: 'session-northwind' });

let useAppStore: StoryStore;

type VisibilityParams = {
  readonly state: 'visible' | 'hidden';
};

const setVisibility = ({ state }: VisibilityParams): void => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
};

const readSessions = (): ReadonlyArray<unknown> =>
  vi.mocked(listAutoTreesOfSession).mock.calls.map(([params]) => params.sessionId);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.mocked(listAutoTreesOfSession).mockClear();
  act(() => {
    useAppStore.setState({
      sessions: [aSession({ id: HARBORLINE }), aSession({ id: NORTHWIND })],
      sessionPhaseRuns: {
        [HARBORLINE]: [anAgent({ sessionId: HARBORLINE, kind: 'auto', status: 'running' })],
        [NORTHWIND]: [anAgent({ sessionId: NORTHWIND, status: 'completed' })],
      },
    });
  });
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setVisibility({ state: 'visible' });
});

describe('useAutoBoardWatch', () => {
  it('reads the Auto trees of a session with a live Auto agent from a hidden window', async () => {
    setVisibility({ state: 'hidden' });
    renderHook(() => useAutoBoardWatch());

    await vi.advanceTimersByTimeAsync(10_000);

    expect(readSessions()).toEqual([HARBORLINE]);
  });

  it('stops reading once the Auto agent of the session settled', async () => {
    renderHook(() => useAutoBoardWatch());
    await vi.advanceTimersByTimeAsync(2000);
    act(() => {
      useAppStore.setState({
        sessionPhaseRuns: {
          [HARBORLINE]: [anAgent({ sessionId: HARBORLINE, kind: 'auto', status: 'completed' })],
        },
      });
    });
    vi.mocked(listAutoTreesOfSession).mockClear();

    await vi.advanceTimersByTimeAsync(6000);

    expect(readSessions()).toEqual([]);
  });

  it('never reads a tree that rests, nor a blocked tree with no live agent', async () => {
    act(() => {
      useAppStore.setState({
        sessionPhaseRuns: {
          [HARBORLINE]: [anAgent({ sessionId: HARBORLINE, kind: 'auto', status: 'completed' })],
          [NORTHWIND]: [anAgent({ sessionId: NORTHWIND, status: 'completed' })],
        },
        autoTreeViews: {
          [HARBORLINE]: [aView({ phase: 'answering' })],
          [NORTHWIND]: [aView({ phase: 'blocked' })],
        },
      });
    });
    renderHook(() => useAutoBoardWatch());

    await vi.advanceTimersByTimeAsync(6000);

    expect(readSessions()).toEqual([]);
  });

  it('reads a blocked tree while one of its agents still runs, and a working tree', async () => {
    act(() => {
      useAppStore.setState({
        sessionPhaseRuns: {
          [HARBORLINE]: [anAgent({ sessionId: HARBORLINE, kind: 'auto', status: 'completed' })],
          [NORTHWIND]: [anAgent({ sessionId: NORTHWIND, status: 'running' })],
        },
        autoTreeViews: {
          [HARBORLINE]: [aView({ phase: 'delegating' })],
          [NORTHWIND]: [aView({ phase: 'blocked' })],
        },
      });
    });
    renderHook(() => useAutoBoardWatch());

    await vi.advanceTimersByTimeAsync(2000);

    expect(new Set(readSessions())).toEqual(new Set([HARBORLINE, NORTHWIND]));
  });
});
