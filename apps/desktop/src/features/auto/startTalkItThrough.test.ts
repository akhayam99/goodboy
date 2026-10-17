// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { startTalkItThrough } from './startTalkItThrough';
import { talkItThroughGoal } from './talkItThroughGoal';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ newDrawerDrafts: {}, drawer: null });
});

describe('startTalkItThrough', () => {
  it('seeds the Auto goal of the drawer with the card and opens the Start an auto form, without starting', () => {
    startTalkItThrough({
      state: useAppStore.getState(),
      sessionId: SESSION,
      title: 'Implement the retry guard',
      detail: 'The plan is approved',
    });

    expect(useAppStore.getState().newDrawerDrafts[SESSION]?.autoGoal).toBe(
      talkItThroughGoal({ title: 'Implement the retry guard', detail: 'The plan is approved' }),
    );
    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'new',
      sessionId: SESSION,
      payload: { form: 'auto' },
    });
  });
});

describe('talkItThroughGoal', () => {
  it('puts the card in the goal and tells Auto to talk before it starts any work', () => {
    const goal = talkItThroughGoal({ title: 'Test the retry path', detail: null });

    expect(goal).toContain('before you start any work');
    expect(goal.endsWith('Test the retry path')).toBe(true);
  });
});
