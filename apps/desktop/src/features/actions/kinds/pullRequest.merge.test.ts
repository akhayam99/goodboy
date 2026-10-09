// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { PullRequestState, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { resolveActions } from '../resolveActions';
import type { ActionEnv } from '../types';
import { PULL_REQUEST_KIND } from './pullRequest';
import type { PullRequestFacts } from './pullRequestFacts';

const SESSION = 'session-harborline' as SessionId;

const PR: PullRequestState = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'hl/fix-duplicate-credit',
  isDraft: false,
  reviewDecision: 'approved',
  body: '',
  updatedAt: '2026-09-20T10:00:00Z',
  author: 'nadia-p',
};

const facts = (overrides: Partial<PullRequestFacts> = {}): PullRequestFacts => ({
  sessionId: SESSION,
  pr: PR,
  number: 318,
  phase: 'open',
  checks: 'green',
  failingChecks: [],
  runningChecks: 0,
  failingLogUrl: null,
  review: 'approved',
  changesRequestedBy: [],
  hasConflicts: false,
  openComments: 0,
  isOwn: true,
  writeInFlight: null,
  isDraftAgentRunning: false,
  commentsNeedYou: 0,
  isFixRunLive: false,
  mergeMethods: ['squash', 'merge', 'rebase'],
  mergeMethodReasons: {},
  commitCount: 5,
  ...overrides,
});

const ENV: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'palette',
  anchorKey: null,
  viewing: null,
};

const mergeOf = (state: PullRequestFacts) =>
  resolveActions({ definitions: PULL_REQUEST_KIND.actions, facts: state }).find(
    (action) => action.id === 'pullRequest.merge',
  );

describe('the merge action', () => {
  it('is named Merge and primary when nothing is outstanding', () => {
    const merge = mergeOf(facts());
    expect(merge?.label).toBe('Merge');
    expect(merge?.shortLabel).toBe('Merge');
    expect(merge?.slot).toBe('primary');
    expect(merge?.blockedReason).toBeNull();
  });

  it('turns secondary and counts the comments that need the owner, never disabled', () => {
    const merge = mergeOf(facts({ commentsNeedYou: 3 }));
    expect(merge?.shortLabel).toBe('Merge · 3 open');
    expect(merge?.slot).toBe('secondary');
    expect(merge?.blockedReason).toBeNull();
    expect(merge?.confirm?.confirmLabel).toBe('Merge anyway');
  });

  it('turns secondary while a fix run is live, never disabled', () => {
    const merge = mergeOf(facts({ isFixRunLive: true }));
    expect(merge?.slot).toBe('secondary');
    expect(merge?.blockedReason).toBeNull();
  });

  it('is blocked with the readiness reason while a check fails', () => {
    const merge = mergeOf(facts({ checks: 'failing', failingChecks: ['unit tests'] }));
    expect(merge?.slot).toBe('secondary');
    expect(merge?.blockedReason).toBe('1 check failing: unit tests.');
  });
});

describe('the merge confirm choice', () => {
  const choiceOf = (state: PullRequestFacts) => mergeOf(state)?.confirm?.choice;

  it('lists the three methods with their effect sentences', () => {
    const choice = choiceOf(facts());
    expect(choice?.options.map((option) => [option.id, option.label, option.detail])).toEqual([
      ['squash', 'Squash and merge', 'One commit on main'],
      ['merge', 'Merge commit', 'All 5 commits and a merge commit'],
      ['rebase', 'Rebase and merge', '5 commits on top of main'],
    ]);
    expect(choice?.options.every((option) => option.disabledReason === null)).toBe(true);
  });

  it('defaults to squash when the repository allows it', () => {
    expect(choiceOf(facts())?.defaultId).toBe('squash');
  });

  it('disables a method the repository forbids and names the reason', () => {
    const choice = choiceOf(
      facts({
        mergeMethods: ['squash', 'rebase'],
        mergeMethodReasons: { merge: 'Turned off in payments-api' },
      }),
    );
    expect(choice?.options.map((option) => [option.id, option.disabledReason])).toEqual([
      ['squash', null],
      ['merge', 'Turned off in payments-api'],
      ['rebase', null],
    ]);
  });

  it('defaults to the first allowed method when squash is forbidden', () => {
    const choice = choiceOf(
      facts({
        mergeMethods: ['merge'],
        mergeMethodReasons: { squash: 'Set by the project', rebase: 'Set by the project' },
      }),
    );
    expect(choice?.defaultId).toBe('merge');
  });

  const runMerge = async (choice: string | null, state: PullRequestFacts = facts()) => {
    const mergePr = vi.fn(async () => undefined);
    useAppStore.setState({
      mergePr,
      refreshSessionPr: vi.fn(async () => undefined),
      refreshSessionPrDetail: vi.fn(async () => undefined),
    });
    const merge = PULL_REQUEST_KIND.actions.find((action) => action.id === 'pullRequest.merge');
    await merge?.run({ facts: state, env: ENV, choice });
    return mergePr;
  };

  it('sends the chosen method to the merge', async () => {
    expect(await runMerge('rebase')).toHaveBeenCalledWith(SESSION, 318, 'rebase');
    expect(await runMerge('merge')).toHaveBeenCalledWith(SESSION, 318, 'merge');
  });

  it('falls back to the default method when nothing was chosen', async () => {
    expect(await runMerge(null)).toHaveBeenCalledWith(SESSION, 318, 'squash');
    expect(await runMerge('fast-forward')).toHaveBeenCalledWith(SESSION, 318, 'squash');
  });
});
