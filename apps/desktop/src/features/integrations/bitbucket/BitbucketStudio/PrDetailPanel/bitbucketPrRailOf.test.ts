import { describe, expect, it } from 'vitest';
import type { PrCheckRun } from '@goodboy/types';
import type { BitbucketPullRequest, BitbucketUser } from '../../client';
import { bitbucketPrRailOf } from './bitbucketPrRailOf';

const userOf = (displayName: string): BitbucketUser => ({
  uuid: displayName,
  accountId: null,
  nickname: displayName,
  displayName,
  avatarUrl: null,
});

const prOf = (overrides: Partial<BitbucketPullRequest>): BitbucketPullRequest => ({
  id: 3,
  title: 'Raise the fuel constant',
  description: '',
  state: 'OPEN',
  createdOn: '2026-08-01T10:00:00Z',
  updatedOn: '2026-08-01T10:00:00Z',
  sourceBranch: 'fuel',
  sourceCommit: null,
  destinationBranch: 'main',
  destinationCommit: null,
  author: null,
  reviewers: [],
  participants: [],
  closeSourceBranch: false,
  mergeCommit: null,
  commentCount: 0,
  taskCount: 0,
  webUrl: null,
  ...overrides,
});

const failingRun: PrCheckRun = {
  name: 'unit tests',
  conclusion: 'failure',
  detailsUrl: null,
  durationMs: null,
};

describe('bitbucketPrRailOf', () => {
  it('feeds reviewers from the participants and the checks from the statuses', () => {
    const rail = bitbucketPrRailOf({
      pullRequest: prOf({
        author: userOf('Harbor Dev'),
        participants: [
          { user: userOf('Ana'), role: 'REVIEWER', approved: true, state: 'approved' },
          { user: userOf('Bo'), role: 'REVIEWER', approved: false, state: null },
          { user: userOf('Cy'), role: 'PARTICIPANT', approved: false, state: null },
        ],
      }),
      checks: [failingRun],
    });
    expect(rail.reviewers.map((entry) => [entry.person.login, entry.state])).toEqual([
      ['Ana', 'approved'],
      ['Bo', 'pending'],
    ]);
    expect(rail.checks?.failingNames).toEqual(['unit tests']);
    expect(rail.author?.login).toBe('Harbor Dev');
  });

  it('hides every row the host has no fact for', () => {
    const rail = bitbucketPrRailOf({ pullRequest: prOf({}), checks: [] });
    expect(rail.reviewers).toEqual([]);
    expect(rail.checks).toBeNull();
    expect(rail.author).toBeNull();
    expect(rail.linked).toEqual([]);
  });
});
