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
import {
  openQuestionFor,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { stageInfosOf } from './stageInfosOf';

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

describe('stageInfosOf', () => {
  it('derives one set of infos for every caller of the same store state', () => {
    const state = useAppStore.getState();

    const first = stageInfosOf({ state, sessions: state.sessions });
    const second = stageInfosOf({ state: { ...state }, sessions: state.sessions });

    expect(second).toBe(first);
    expect(Object.keys(first)).toHaveLength(2);
  });

  it('keeps the same infos when a write touches nothing the stage reads', () => {
    const before = stageInfosOf({
      state: useAppStore.getState(),
      sessions: useAppStore.getState().sessions,
    });

    useAppStore.setState({ detectedEditors: [] });
    const after = stageInfosOf({
      state: useAppStore.getState(),
      sessions: useAppStore.getState().sessions,
    });

    expect(after).toBe(before);
  });

  it('derives again once an input the stage reads has changed', () => {
    const sessions = useAppStore.getState().sessions;
    const [current] = sessions;
    if (current === undefined) {
      throw new Error('seed has no session');
    }
    const before = stageInfosOf({ state: useAppStore.getState(), sessions });

    useAppStore.setState((state) => ({
      sessionOpenQuestions: {
        ...state.sessionOpenQuestions,
        [current.id]: [openQuestionFor({ sessionId: current.id })],
      },
    }));
    const after = stageInfosOf({ state: useAppStore.getState(), sessions });

    expect(after).not.toBe(before);
    expect(after[current.id]?.openQuestionCount).toBe(1);
  });
});
