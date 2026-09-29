import { describe, expect, it } from 'vitest';
import type { PullRequestStateKind } from '@goodboy/types';
import type { GitlabMergeRequest } from './client';
import { gitlabMrStateKind } from './gitlabMrStateKind';

const mr = (overrides: Partial<GitlabMergeRequest>): GitlabMergeRequest => ({
  id: 1,
  iid: 1,
  projectId: 1,
  title: 'Retry ledger sync',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.example.test/acme/ledger-core/-/merge_requests/1',
  sourceBranch: 'fix/retry',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: '2026-09-29T08:00:00Z',
  ...overrides,
});

const TABLE: ReadonlyArray<readonly [string, boolean, PullRequestStateKind]> = [
  ['opened', false, 'open'],
  ['opened', true, 'draft'],
  ['merged', false, 'merged'],
  ['merged', true, 'merged'],
  ['closed', false, 'closed'],
  ['closed', true, 'closed'],
  ['locked', false, 'closed'],
  ['locked', true, 'closed'],
  ['something-new', false, 'open'],
  ['something-new', true, 'draft'],
];

describe('gitlabMrStateKind', () => {
  it.each(TABLE)('reads state %s with draft %s as %s', (state, draft, kind) => {
    expect(gitlabMrStateKind({ mr: mr({ state, draft }) })).toBe(kind);
  });
});
