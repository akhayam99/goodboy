import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';
import { setPullRequestMode } from './setPullRequestMode';
import type { SetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const OTHER_SESSION_ID = 'session-2' as SessionId;

const createHarness = () => {
  let state = { pullRequestModes: {} } as unknown as AppStore;
  let writes = 0;
  const set: SetFn = (patch) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    if (next === state) {
      return;
    }
    writes += 1;
    state = { ...state, ...next };
  };
  return { set, read: () => state, writes: () => writes };
};

describe('setPullRequestMode', () => {
  it('keeps the open pull request page mode per session', () => {
    const harness = createHarness();

    setPullRequestMode({ set: harness.set, sessionId: SESSION_ID, mode: 'write_review' });
    setPullRequestMode({ set: harness.set, sessionId: OTHER_SESSION_ID, mode: 'create_pr' });

    expect(harness.read().pullRequestModes).toEqual({
      [SESSION_ID]: 'write_review',
      [OTHER_SESSION_ID]: 'create_pr',
    });
  });

  it('treats a missing mode as the overview and skips a write that changes nothing', () => {
    const harness = createHarness();

    setPullRequestMode({ set: harness.set, sessionId: SESSION_ID, mode: 'overview' });

    expect(harness.writes()).toBe(0);
  });
});
