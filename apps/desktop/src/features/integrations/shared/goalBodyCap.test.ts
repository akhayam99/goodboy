import { describe, expect, it } from 'vitest';
import type { GithubIssue } from '@goodboy/types';
import { goalFromIssue as goalFromGithubIssue } from '../../github/goal-from-issue';
import { goalFromPullRequest } from '../bitbucket/goal-from-pull-request';
import { goalFromMergeRequest } from '../gitlab/goal-from-merge-request';
import { GOAL_BODY_CHAR_CAP } from './goalBodyCap';

const PARAGRAPH = `${'y'.repeat(99)}.`;
const LONG = Array.from({ length: 15 }, () => PARAGRAPH).join('\n\n');
const KEPT = Array.from({ length: 11 }, () => PARAGRAPH).join('\n\n');

describe('goal body cap', () => {
  it('keeps whole paragraphs under the cap', () => {
    expect(KEPT.length).toBeLessThanOrEqual(GOAL_BODY_CHAR_CAP);
    expect(LONG.length).toBeGreaterThan(GOAL_BODY_CHAR_CAP);
  });

  it('cuts a GitHub issue body at a paragraph and points at the full issue', () => {
    const issue: GithubIssue = {
      number: 7,
      title: 'Retry ledger sync',
      body: LONG,
      url: 'https://github.com/acme/ledger-core/issues/7',
      state: 'OPEN',
      labels: [],
      updatedAt: '2026-09-01T00:00:00Z',
    };
    expect(goalFromGithubIssue({ issue })).toBe(
      `GitHub issue #7: Retry ledger sync\n\n${KEPT}\n\nFull issue: #7 https://github.com/acme/ledger-core/issues/7`,
    );
  });

  it('cuts a Bitbucket pull request description and names it without a link', () => {
    const pullRequest = { id: 12, title: 'Split billing export', description: LONG };
    expect(goalFromPullRequest({ pullRequest: pullRequest as never })).toBe(
      `Bitbucket pull request #12: Split billing export\n\n${KEPT}\n\nFull pull request: #12`,
    );
  });

  it('cuts a GitLab merge request description', () => {
    const mergeRequest = {
      iid: 31,
      title: 'Queue relay retries',
      description: LONG,
      webUrl: 'https://gitlab.com/acme/relay/-/merge_requests/31',
    };
    expect(goalFromMergeRequest({ mergeRequest: mergeRequest as never })).toBe(
      `GitLab merge request !31: Queue relay retries\n\n${KEPT}\n\nFull merge request: !31 https://gitlab.com/acme/relay/-/merge_requests/31`,
    );
  });

  it('adds no pointer when the body fits', () => {
    const pullRequest = { id: 3, title: 'Tidy', description: PARAGRAPH };
    expect(goalFromPullRequest({ pullRequest: pullRequest as never })).toBe(
      `Bitbucket pull request #3: Tidy\n\n${PARAGRAPH}`,
    );
  });
});
