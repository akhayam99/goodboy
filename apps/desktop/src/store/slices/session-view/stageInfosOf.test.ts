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
import type { SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { seedColumn, sessionOf } from '../../../features/workspace/testing/sessionColumn';
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
    currentSessionId: current.id as SessionId,
  });
});

afterEach(cleanup);

describe('stageInfosOf', () => {
  it('derives one set of infos for every caller of the same store state', () => {
    const state = useAppStore.getState();

    const first = stageInfosOf({ state });
    const second = stageInfosOf({ state: { ...state } });

    expect(second).toBe(first);
    expect(Object.keys(first)).toHaveLength(2);
  });

  it('derives again once an input the stage reads has changed', () => {
    const before = stageInfosOf({ state: useAppStore.getState() });

    useAppStore.setState({ currentSessionId: null });
    const after = stageInfosOf({ state: useAppStore.getState() });

    expect(after).not.toBe(before);
  });
});
