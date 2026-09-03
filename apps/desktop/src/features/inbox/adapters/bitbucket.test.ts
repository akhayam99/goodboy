import { describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import type { BitbucketPullRequest, BitbucketRepo } from '../../integrations/bitbucket/client';
import type { BitbucketPrGroup } from '../../integrations/bitbucket/BitbucketStudio/useBitbucketPrs';
import { adaptBitbucketPrs } from './bitbucket';

const pullRequest = (overrides: Partial<BitbucketPullRequest> = {}): BitbucketPullRequest => ({
  id: 55,
  title: 'Ship the inbox adapters',
  description: '',
  state: 'OPEN',
  createdOn: '2026-07-30T10:00:00Z',
  updatedOn: '2026-08-01T10:00:00Z',
  sourceBranch: 'feat/inbox',
  sourceCommit: null,
  destinationBranch: 'main',
  destinationCommit: null,
  author: null,
  reviewers: [],
  participants: [],
  closeSourceBranch: true,
  mergeCommit: null,
  commentCount: 0,
  taskCount: 0,
  webUrl: 'https://bitbucket.org/goodboy/goodboy/pull-requests/55',
  ...overrides,
});

const repo: BitbucketRepo = {
  workspaceId: 'workspace-1' as WorkspaceId,
  workspaceSlug: 'goodboy',
  repoSlug: 'goodboy',
  email: 'dev@goodboy.works',
};

describe('adaptBitbucketPrs', () => {
  it('maps a pull request row into a normalized inbox record', () => {
    const groups: ReadonlyArray<BitbucketPrGroup> = [
      { key: 'Open', label: 'Open', rows: [pullRequest()] },
    ];

    const [record] = adaptBitbucketPrs({ groups, repo });

    expect(record).toEqual({
      key: 'bitbucket:pr:55',
      provider: 'bitbucket',
      kind: 'pr',
      identifier: '#55',
      title: 'Ship the inbox adapters',
      state: 'open',
      updatedAt: '2026-08-01T10:00:00Z',
      url: 'https://bitbucket.org/goodboy/goodboy/pull-requests/55',
      meta: 'goodboy/goodboy',
      payload: { provider: 'bitbucket', kind: 'pr', pullRequest: pullRequest(), repo },
    });
  });

  it('falls back to the group label when no repo is resolved', () => {
    const groups: ReadonlyArray<BitbucketPrGroup> = [
      { key: 'Open', label: 'goodboy/legacy', rows: [pullRequest()] },
    ];

    const [record] = adaptBitbucketPrs({ groups, repo: null });

    expect(record?.meta).toBe('goodboy/legacy');
  });

  it.each([
    ['OPEN', 'open'],
    ['MERGED', 'done'],
    ['DECLINED', 'done'],
    ['SUPERSEDED', 'done'],
  ] as const)('normalizes state %s to %s', (state, expected) => {
    const groups: ReadonlyArray<BitbucketPrGroup> = [
      { key: 'g', label: 'g', rows: [pullRequest({ state })] },
    ];

    const [record] = adaptBitbucketPrs({ groups, repo: null });

    expect(record?.state).toBe(expected);
  });

  it('falls back to an empty url when the pull request has none', () => {
    const groups: ReadonlyArray<BitbucketPrGroup> = [
      { key: 'g', label: 'g', rows: [pullRequest({ webUrl: null })] },
    ];

    const [record] = adaptBitbucketPrs({ groups, repo: null });

    expect(record?.url).toBe('');
  });
});
