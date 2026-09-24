import { describe, expect, it } from 'vitest';
import type { AppState } from '../../types';
import { sessionAwaitsPullRequest } from './sessionAwaitsPullRequest';

const SESSION_ID = 'sess-1' as never;

const stateOf = (partial: Record<string, unknown>): AppState => partial as unknown as AppState;

describe('sessionAwaitsPullRequest', () => {
  it('keeps waiting while any mount of the session has no pull request', () => {
    const state = stateOf({
      sessionProjectMounts: {
        'sess-1': [{ mountId: 'mount-1' }, { mountId: 'mount-2' }],
      },
      mountGithub: { 'mount-1': { pr: { number: 9837 } } },
      sessionGithub: { 'sess-1': { pr: { number: 9837 } } },
    });

    expect(sessionAwaitsPullRequest({ state, sessionId: SESSION_ID })).toBe(true);
  });

  it('stops once every mount carries one', () => {
    const state = stateOf({
      sessionProjectMounts: {
        'sess-1': [{ mountId: 'mount-1' }, { mountId: 'mount-2' }],
      },
      mountGithub: {
        'mount-1': { pr: { number: 9837 } },
        'mount-2': { pr: { number: 9839 } },
      },
    });

    expect(sessionAwaitsPullRequest({ state, sessionId: SESSION_ID })).toBe(false);
  });

  it('falls back to the session link when the session has no mounts', () => {
    expect(
      sessionAwaitsPullRequest({
        state: stateOf({ sessionGithub: { 'sess-1': { pr: null } } }),
        sessionId: SESSION_ID,
      }),
    ).toBe(true);
    expect(
      sessionAwaitsPullRequest({
        state: stateOf({ sessionGithub: { 'sess-1': { pr: { number: 9837 } } } }),
        sessionId: SESSION_ID,
      }),
    ).toBe(false);
  });
});
