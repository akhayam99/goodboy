import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';
import { setReviewMode } from './setReviewMode';
import type { SetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const OTHER_SESSION_ID = 'session-2' as SessionId;

const createHarness = () => {
  let state = { reviewModes: {} } as unknown as AppStore;
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

describe('setReviewMode', () => {
  it('keeps the open review mode per session', () => {
    const harness = createHarness();

    setReviewMode({ set: harness.set, sessionId: SESSION_ID, mode: 'pr_details' });
    setReviewMode({ set: harness.set, sessionId: OTHER_SESSION_ID, mode: 'checks' });

    expect(harness.read().reviewModes).toEqual({
      [SESSION_ID]: 'pr_details',
      [OTHER_SESSION_ID]: 'checks',
    });
  });

  it('treats a missing mode as the queue and skips a write that changes nothing', () => {
    const harness = createHarness();

    setReviewMode({ set: harness.set, sessionId: SESSION_ID, mode: 'queue' });

    expect(harness.writes()).toBe(0);
  });
});
