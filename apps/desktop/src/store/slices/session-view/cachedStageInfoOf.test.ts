// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { seedColumn, sessionOf } from '../../../features/workspace/testing/sessionColumn';
import { cachedStageInfoOf } from './cachedStageInfoOf';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const current = sessionOf({ goal: 'Retry webhooks' });
  seedColumn({
    store: useAppStore,
    sessions: [current, sessionOf({ goal: 'Fix rounding' })],
    currentSessionId: current.id,
  });
});

afterEach(cleanup);

describe('cachedStageInfoOf', () => {
  it('returns the same info for a state whose inputs did not change', () => {
    const state = useAppStore.getState();
    const session = state.sessions[0];
    if (session === undefined) {
      throw new Error('seed has no session');
    }

    const first = cachedStageInfoOf({ state, session });
    const second = cachedStageInfoOf({ state: { ...state }, session });

    expect(second).toBe(first);
  });

  it('derives again once an input the stage reads has changed', () => {
    const session = useAppStore.getState().sessions[0];
    if (session === undefined) {
      throw new Error('seed has no session');
    }
    const before = cachedStageInfoOf({ state: useAppStore.getState(), session });

    useAppStore.setState({ currentSessionId: null });
    const after = cachedStageInfoOf({ state: useAppStore.getState(), session });

    expect(after).not.toBe(before);
  });
});
