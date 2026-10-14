// @vitest-environment node

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

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandedId } from '../../../features/history/testing/brandedId';
import type { SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const FIRST = brandedId<SessionId>({ value: 'session-1' });
const SECOND = brandedId<SessionId>({ value: 'session-2' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('newDrawerDrafts slice', () => {
  it('keeps the Auto goal per session', () => {
    useAppStore.getState().setNewDrawerAutoGoal({ sessionId: FIRST, goal: 'find the retry' });
    useAppStore.getState().setNewDrawerAutoGoal({ sessionId: SECOND, goal: 'draw the flow' });

    expect(useAppStore.getState().newDrawerDrafts[FIRST]).toEqual({ autoGoal: 'find the retry' });
    expect(useAppStore.getState().newDrawerDrafts[SECOND]).toEqual({ autoGoal: 'draw the flow' });
  });

  it('drops the entry when the goal is emptied, leaving the other session alone', () => {
    useAppStore.getState().setNewDrawerAutoGoal({ sessionId: FIRST, goal: 'find the retry' });
    useAppStore.getState().setNewDrawerAutoGoal({ sessionId: SECOND, goal: 'draw the flow' });

    useAppStore.getState().setNewDrawerAutoGoal({ sessionId: FIRST, goal: '' });

    expect(useAppStore.getState().newDrawerDrafts[FIRST]).toBeUndefined();
    expect(useAppStore.getState().newDrawerDrafts[SECOND]).toEqual({ autoGoal: 'draw the flow' });
  });
});
