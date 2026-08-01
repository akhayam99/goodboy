import { describe, expect, it } from 'vitest';
import type { LinkedIssue, PullRequestState, SessionExternalTask } from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../integrations/gitlab/client';
import { definitionOfDone } from './definitionOfDone';

const pr = (over: Partial<PullRequestState> = {}): PullRequestState =>
  ({ number: 123, state: 'open', isDraft: false, ...over }) as PullRequestState;

const issue = (over: Partial<LinkedIssue> = {}): LinkedIssue =>
  ({
    number: 7,
    url: 'https://github.com/acme/repo/issues/7',
    closes: true,
    ...over,
  }) as LinkedIssue;

const task = (over: Partial<SessionExternalTask> = {}): SessionExternalTask =>
  ({
    provider: 'linear',
    externalId: 'linear-456',
    identifier: 'LIN-456',
    url: 'https://linear.app/acme/issue/LIN-456',
    title: 'Ship it',
    ...over,
  }) as SessionExternalTask;

const mr = (over: Partial<GitlabMergeRequest> = {}): GitlabMergeRequest =>
  ({ iid: 12, ...over }) as GitlabMergeRequest;

const base = {
  pr: null,
  mergeRequest: null,
  linkedIssues: [] as ReadonlyArray<LinkedIssue>,
  externalTasks: [] as ReadonlyArray<SessionExternalTask>,
};

describe('definitionOfDone', () => {
  it('states what must happen for the pull request and the linked task', () => {
    expect(definitionOfDone({ ...base, pr: pr(), externalTasks: [task()] })).toBe(
      'Done when PR #123 merges and LIN-456 closes',
    );
  });

  it('uses the verb each provider deserves', () => {
    expect(
      definitionOfDone({
        ...base,
        mergeRequest: mr(),
        externalTasks: [
          task({ provider: 'sentry', identifier: 'GOODBOY-7' }),
          task({ provider: 'linear', identifier: 'LIN-1' }),
        ],
      }),
    ).toBe('Done when MR !12 merges, GOODBOY-7 resolves and LIN-1 closes');
  });

  it('keeps a linked issue only when linking it declared the closing intent', () => {
    expect(
      definitionOfDone({ ...base, linkedIssues: [issue(), issue({ number: 9, closes: false })] }),
    ).toBe('Done when #7 closes');
  });

  it('ignores the current state of the pull request', () => {
    expect(definitionOfDone({ ...base, pr: pr({ state: 'merged' }) })).toBe(
      'Done when PR #123 merges',
    );
  });

  it('says nothing when nothing is linked, rather than repeating the goal above it', () => {
    expect(definitionOfDone(base)).toBe('');
  });
});
