import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { nextSessionId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const SESSION_ID = nextSessionId();
const OTHER_SESSION_ID = nextSessionId();

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('markScriptRunSeen', () => {
  it('remembers the run of a script whose output was opened, per session', () => {
    useAppStore
      .getState()
      .markScriptRunSeen({ sessionId: SESSION_ID, scriptKey: 'drift', runId: 'run-1' });
    useAppStore
      .getState()
      .markScriptRunSeen({ sessionId: OTHER_SESSION_ID, scriptKey: 'drift', runId: 'run-7' });

    expect(useAppStore.getState().scriptRunsSeen[SESSION_ID]).toEqual({ drift: 'run-1' });
    expect(useAppStore.getState().scriptRunsSeen[OTHER_SESSION_ID]).toEqual({ drift: 'run-7' });
  });

  it('moves to the newer run of the same script and keeps the other scripts', () => {
    const { markScriptRunSeen } = useAppStore.getState();
    markScriptRunSeen({ sessionId: SESSION_ID, scriptKey: 'drift', runId: 'run-1' });
    markScriptRunSeen({ sessionId: SESSION_ID, scriptKey: 'lint', runId: 'run-2' });
    markScriptRunSeen({ sessionId: SESSION_ID, scriptKey: 'drift', runId: 'run-3' });

    expect(useAppStore.getState().scriptRunsSeen[SESSION_ID]).toEqual({
      drift: 'run-3',
      lint: 'run-2',
    });
  });

  it('leaves the state alone when the run was already marked', () => {
    const { markScriptRunSeen } = useAppStore.getState();
    markScriptRunSeen({ sessionId: SESSION_ID, scriptKey: 'drift', runId: 'run-1' });
    const before = useAppStore.getState().scriptRunsSeen;

    markScriptRunSeen({ sessionId: SESSION_ID, scriptKey: 'drift', runId: 'run-1' });

    expect(useAppStore.getState().scriptRunsSeen).toBe(before);
  });
});
