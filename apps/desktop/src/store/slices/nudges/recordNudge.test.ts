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
import { nextSessionId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';

let useAppStore: StoryStore;

const SESSION_ID = nextSessionId();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.insertNudgeEvent.mockClear();
  storySpies.updateNudgeEventOutcome.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('recordNudgeShown', () => {
  it('writes one nudge event for the session and gives back its id', async () => {
    const id = await useAppStore.getState().recordNudgeShown({
      sessionId: SESSION_ID,
      kind: 'scope-mismatch',
      context: { agentKind: 'planner' },
    });
    expect(storySpies.insertNudgeEvent).toHaveBeenCalledTimes(1);
    expect(storySpies.insertNudgeEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id,
        sessionId: SESSION_ID,
        kind: 'scope-mismatch',
        contextJson: JSON.stringify({ agentKind: 'planner' }),
        outcome: null,
      }),
    );
  });

  it('still gives back an id when the write fails, so the caller keeps going', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    storySpies.insertNudgeEvent.mockRejectedValueOnce(new Error('database is locked'));
    const id = await useAppStore.getState().recordNudgeShown({
      sessionId: SESSION_ID,
      kind: 'model-rightsize',
      context: {},
    });
    expect(typeof id).toBe('string');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('recordNudgeOutcome', () => {
  it('writes the outcome of the nudge event it names', async () => {
    await useAppStore.getState().recordNudgeOutcome({ id: 'nudge-event-1', outcome: 'accepted' });
    expect(storySpies.updateNudgeEventOutcome).toHaveBeenCalledWith(
      expect.anything(),
      'nudge-event-1',
      'accepted',
      expect.any(String),
    );
  });

  it('does not throw when the write fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    storySpies.updateNudgeEventOutcome.mockRejectedValueOnce(new Error('database is locked'));
    await expect(
      useAppStore.getState().recordNudgeOutcome({ id: 'nudge-event-1', outcome: 'dismissed' }),
    ).resolves.toBeUndefined();
  });
});
