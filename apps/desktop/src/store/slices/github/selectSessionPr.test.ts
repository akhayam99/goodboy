import { describe, expect, it, vi } from 'vitest';
import type { PullRequestState, SessionId } from '@goodboy/types';
import { selectSessionPr } from './selectSessionPr';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;

const pr = (number: number): PullRequestState =>
  ({ number, title: `pr ${number}`, state: 'open' }) as PullRequestState;

const harness = (selected: number) => {
  const refreshSessionPrDetail = vi.fn(async () => undefined);
  const state = {
    sessionGithubPrs: { [SESSION_ID]: [pr(42), pr(40)] },
    sessionGithub: {
      [SESSION_ID]: { pr: pr(selected), detail: { checks: [] }, detailFetchedAt: 'x' },
    },
    refreshSessionPrDetail,
  };
  const set = ((updater: (current: typeof state) => Partial<typeof state>) => {
    Object.assign(state, updater(state));
  }) as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  return { state, set, get, refreshSessionPrDetail };
};

describe('selectSessionPr', () => {
  it('switches the session pr and reloads its detail', async () => {
    const { state, set, get, refreshSessionPrDetail } = harness(42);

    await selectSessionPr(set, get)(SESSION_ID, 40);

    expect(state.sessionGithub[SESSION_ID]?.pr?.number).toBe(40);
    expect(state.sessionGithub[SESSION_ID]?.detail).toBeNull();
    expect(refreshSessionPrDetail).toHaveBeenCalledWith(SESSION_ID, { force: true });
  });

  it('ignores unknown numbers and re-selection of the current pr', async () => {
    const { state, set, get, refreshSessionPrDetail } = harness(42);

    await selectSessionPr(set, get)(SESSION_ID, 99);
    await selectSessionPr(set, get)(SESSION_ID, 42);

    expect(state.sessionGithub[SESSION_ID]?.pr?.number).toBe(42);
    expect(refreshSessionPrDetail).not.toHaveBeenCalled();
  });
});
