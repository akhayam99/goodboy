// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { seedBoardScene } from '../../scenes/BoardScene';
import { installBoardActions } from './installBoardActions';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('the demo board', () => {
  it('gives every seeded card a loaded session to open', () => {
    seedBoardScene();
    installBoardActions({ store });
    const state = store.getState();
    for (const session of state.sessions) {
      expect(state.sessionPhaseRuns[session.id]).toBeDefined();
      expect(state.sessionPlans[session.id]).toBeDefined();
      expect(state.sessionSlotsLoad[session.id]).toBe('loaded');
    }
  });

  it('keeps the agents a card already had', () => {
    seedBoardScene();
    const before = store.getState().sessionPhaseRuns;
    installBoardActions({ store });
    for (const session of store.getState().sessions) {
      const agents = before[session.id];
      if (agents !== undefined) {
        expect(store.getState().sessionPhaseRuns[session.id]).toEqual(agents);
      }
    }
  });
});
