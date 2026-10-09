// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { BitbucketPullRequest, BitbucketUser } from './client';
import { mapBitbucketPrToPullRequestState } from './mapBitbucketPrToPullRequestState';

const NADIA: BitbucketUser = {
  uuid: '{nadia-uuid}',
  accountId: null,
  nickname: 'nadia-p',
  displayName: 'Nadia Petrova',
  avatarUrl: null,
};

const PR: BitbucketPullRequest = {
  id: 42,
  title: 'Stop retried webhooks posting a second credit',
  description: 'Key the guard on the event id.',
  state: 'OPEN',
  createdOn: '2026-09-26T08:00:00+00:00',
  updatedOn: '2026-10-06T09:30:00+00:00',
  sourceBranch: 'hl/fix-duplicate-credit',
  sourceCommit: '6c20f48a9e1',
  destinationBranch: 'main',
  destinationCommit: null,
  author: NADIA,
  reviewers: [],
  participants: [],
  closeSourceBranch: false,
  mergeCommit: null,
  commentCount: 0,
  taskCount: 0,
  webUrl: 'https://bitbucket.org/harborline/payments-api/pull-requests/42',
};

describe('mapBitbucketPrToPullRequestState', () => {
  it('maps the request to the state the Branch page reads', () => {
    expect(
      mapBitbucketPrToPullRequestState({ pr: PR, checks: 'failure', reviewDecision: 'approved' }),
    ).toEqual({
      number: 42,
      title: 'Stop retried webhooks posting a second credit',
      url: 'https://bitbucket.org/harborline/payments-api/pull-requests/42',
      state: 'open',
      mergeable: null,
      checks: 'failure',
      baseBranch: 'main',
      headBranch: 'hl/fix-duplicate-credit',
      isDraft: false,
      reviewDecision: 'approved',
      body: 'Key the guard on the event id.',
      updatedAt: '2026-10-06T09:30:00+00:00',
      headSha: '6c20f48a9e1',
      mergedAt: null,
      author: 'nadia-p',
    });
  });

  it.each([
    ['MERGED', 'merged'],
    ['DECLINED', 'closed'],
    ['SUPERSEDED', 'closed'],
  ] as const)('reads %s as %s', (state, kind) => {
    expect(
      mapBitbucketPrToPullRequestState({ pr: { ...PR, state }, checks: null, reviewDecision: null })
        ?.state,
    ).toBe(kind);
  });

  it('keeps what the host does not say as null, never as a guess', () => {
    const mapped = mapBitbucketPrToPullRequestState({
      pr: { ...PR, author: null, webUrl: null, sourceCommit: null },
      checks: null,
      reviewDecision: null,
    });

    expect(mapped).toMatchObject({
      mergeable: null,
      checks: null,
      reviewDecision: null,
      author: null,
      headSha: null,
      url: '',
    });
  });

  it('has nothing to map without a request', () => {
    expect(
      mapBitbucketPrToPullRequestState({ pr: null, checks: null, reviewDecision: null }),
    ).toBeNull();
  });
});
