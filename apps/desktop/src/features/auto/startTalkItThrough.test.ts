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
import { startRunEventName } from '../session/startRun/startRunEventName';
import { startRunDetailOf } from '../session/startRun/startRunDetailOf';
import { startTalkItThrough } from './startTalkItThrough';
import { talkItThroughGoal } from './talkItThroughGoal';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ drawer: null, navigate: vi.fn() });
});

describe('startTalkItThrough', () => {
  it('opens Start a run with the card as its text, without starting', async () => {
    const texts: Array<string> = [];
    const listen = (event: Event): void => {
      texts.push(startRunDetailOf({ event }));
    };
    window.addEventListener(startRunEventName({ sessionId: SESSION }), listen);

    startTalkItThrough({
      sessionId: SESSION,
      title: 'Implement the retry guard',
      detail: 'The plan is approved',
    });

    await vi.waitFor(() => expect(texts).toHaveLength(1));
    window.removeEventListener(startRunEventName({ sessionId: SESSION }), listen);
    expect(texts).toEqual([
      talkItThroughGoal({ title: 'Implement the retry guard', detail: 'The plan is approved' }),
    ]);
    expect(useAppStore.getState().drawer).toBeNull();
    expect(useAppStore.getState().navigate).toHaveBeenCalledWith({
      to: expect.objectContaining({
        at: 'session',
        sessionId: SESSION,
        view: expect.objectContaining({ lens: 'workflows' }),
      }),
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
