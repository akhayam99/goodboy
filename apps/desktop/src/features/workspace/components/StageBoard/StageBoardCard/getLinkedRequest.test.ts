import { describe, expect, it } from 'vitest';
import type { GitlabMergeRequest } from '../../../../integrations/gitlab/client';
import { gitlabMrStateKind } from '../../../../integrations/gitlab/gitlabMrStateKind';
import { getLinkedRequest } from './getLinkedRequest';

const mr = (overrides: Partial<GitlabMergeRequest> = {}): GitlabMergeRequest => ({
  id: 202,
  iid: 12,
  projectId: 5,
  title: 'Settle replayed batches',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/harborline/ledger-core/-/merge_requests/12',
  sourceBranch: 'hl/fix-replay',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: '2026-09-29T10:00:00Z',
  ...overrides,
});

const stateOf = (overrides: Partial<GitlabMergeRequest>) =>
  getLinkedRequest({ pullRequest: null, mergeRequest: mr(overrides) }).state;

describe('getLinkedRequest for a GitLab merge request', () => {
  it('calls a closed draft closed, like the mount row', () => {
    expect(stateOf({ state: 'closed', draft: true })).toBe('closed');
  });

  it('calls a merged draft merged', () => {
    expect(stateOf({ state: 'merged', draft: true })).toBe('merged');
  });

  it('calls a locked merge request queued, since GitLab is merging it, not closed', () => {
    expect(stateOf({ state: 'locked' })).toBe('queued');
  });

  it('keeps an open draft as draft', () => {
    expect(stateOf({ state: 'opened', draft: true })).toBe('draft');
  });

  it.each([
    { state: 'opened', draft: false },
    { state: 'opened', draft: true },
    { state: 'closed', draft: true },
    { state: 'locked', draft: false },
    { state: 'merged', draft: false },
  ])('agrees with the shared state kind for $state draft=$draft', (overrides) => {
    expect(stateOf(overrides)).toBe(gitlabMrStateKind({ mr: mr(overrides) }));
  });
});
