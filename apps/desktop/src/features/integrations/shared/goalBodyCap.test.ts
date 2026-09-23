import { describe, expect, it } from 'vitest';
import type { GithubIssue } from '@goodboy/types';
import { goalFromIssue as goalFromGithubIssue } from '../../github/goal-from-issue';
import { goalFromPullRequest } from '../bitbucket/goal-from-pull-request';
import { goalFromMergeRequest } from '../gitlab/goal-from-merge-request';
import { GOAL_BODY_CHAR_CAP } from './goalBodyCap';

const LONG = 'y'.repeat(GOAL_BODY_CHAR_CAP + 300);
const CAPPED = `${'y'.repeat(GOAL_BODY_CHAR_CAP)}…`;

describe('goal body cap', () => {
  it('caps a GitHub issue body', () => {
    const issue: GithubIssue = {
      number: 7,
      title: 'Retry ledger sync',
      body: LONG,
      url: 'https://github.com/acme/ledger-core/issues/7',
      state: 'OPEN',
      labels: [],
      updatedAt: '2026-09-01T00:00:00Z',
    };
    expect(goalFromGithubIssue({ issue })).toBe(`GitHub issue #7: Retry ledger sync\n\n${CAPPED}`);
  });

  it('caps a Bitbucket pull request description', () => {
    const pullRequest = { id: 12, title: 'Split billing export', description: LONG };
    expect(goalFromPullRequest({ pullRequest: pullRequest as never })).toBe(
      `Bitbucket pull request #12: Split billing export\n\n${CAPPED}`,
    );
  });

  it('caps a GitLab merge request description', () => {
    const mergeRequest = { iid: 31, title: 'Queue relay retries', description: LONG };
    expect(goalFromMergeRequest({ mergeRequest: mergeRequest as never })).toBe(
      `GitLab merge request !31: Queue relay retries\n\n${CAPPED}`,
    );
  });
});
